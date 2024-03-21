import { Resolver, Mutation, Arg, UseMiddleware, Field, ObjectType, ContextType, Ctx, ResType } from 'couchset';
import { log } from '@roadmanjs/logs';
import { passwordLogin, UserType, UserModel, createLoginToken } from '@roadmanjs/auth';
import { getVendorStore } from '../vendor/vendor.methods';
import { generatePgpCode, getVerifiedKey } from './Pgp.methods';
import { MnemonicMiddleware, PgpCodeMiddleware } from './pgpCode.middleware';
import _get from 'lodash/get';
import { isEmpty } from 'lodash';
import { awaitTo } from 'couchset/dist/utils';
import argon2 from 'argon2';
import { createInitChatWithAdmin } from '../_startup/startup';
import { upsertSiteStats } from '../settings/settings.methods';

// LoginResponseType
@ObjectType()
class LoginResponse {
    @Field(() => Boolean, { nullable: false })
    success: boolean;

    @Field(() => String, { nullable: true })
    message?: string;

    @Field(() => Boolean, { nullable: true, description: "2 auth enabled" })
    auth2?: boolean = false;

    @Field(() => String, { nullable: true })
    codeId?: string;

    @Field(() => String, { nullable: true })
    encryptedCode?: string;


    // OLD fields
    @Field(() => String, { nullable: true })
    refreshToken?: string;

    @Field(() => String, { nullable: true })
    accessToken?: string;

    @Field(() => UserType, { nullable: true })
    user?: UserType;
}

@ObjectType()
export class SignUpResponse extends LoginResponse {
    @Field(() => String, { nullable: true })
    mnemonic?: string;
}

@ObjectType()
export class ForgotPasswordResponse extends LoginResponse {
    @Field(() => Boolean, { nullable: true })
    useMnemonic?: boolean;

    @Field(() => String, { nullable: true })
    userId?: string;

    @Field(() => Boolean, { nullable: true, description: "2 auth enabled" })
    auth2?: boolean = false;
    @Field(() => String, { nullable: true })
    codeId?: string;
    @Field(() => String, { nullable: true })
    encryptedCode?: string;

    @Field(() => Boolean, { nullable: false })
    success: boolean;

    @Field(() => String, { nullable: true })
    message?: string;

}

@Resolver()
export class UserAuthResolver {

    // captcha code middleware
    @Mutation(() => LoginResponse)
    async login(
        @Arg('username', () => String, { nullable: false }) username: string,
        @Arg('password', () => String, { nullable: false }) password: string,
    ): Promise<LoginResponse> {
        log(`LOGIN: username=${username}`);

        try {
            const userLogin = await passwordLogin(username, password, false);

            if (!userLogin) {
                throw new Error("Error logging in, please try again")
            }

            if (!userLogin.success) {
                throw new Error(userLogin.message)
            }

            const userId = userLogin.user.id || "";

            // TODO add to schema
            const user2Auth = (userLogin as any).user["auth2"] || false;
            const store = await getVendorStore(userId);

            console.log("store, user2Auth", {
                store,
                user2Auth
            })

            // not store, no 2 auth
            if (!store && !user2Auth) {
                return userLogin;
            }

            // is store or 2 auth
            if (store || user2Auth) {

                const pubKey = await getVerifiedKey(userId);
                if (!pubKey) {
                    throw new Error("Error getting verified key")
                }

                const newPgpCode = await generatePgpCode(pubKey.id || "");
                log("newPgpCode", newPgpCode?.value);
                if (!newPgpCode) {
                    throw new Error("Error generating 2 auth code")
                }

                return {
                    auth2: true,
                    success: true,
                    message: "2 auth code sent",
                    codeId: newPgpCode.id,
                    encryptedCode: newPgpCode.encryptedCode,
                }
            }

            throw new Error("Error logging in, please try again")

        }
        catch (error) {
            console.error(error);
            return {
                auth2: false,
                success: false,
                message: error.message,
            };
        }
    }

    // captcha code middleware
    @Mutation(() => LoginResponse)
    @UseMiddleware(PgpCodeMiddleware())
    async login2Auth(
        @Arg("codeId", { nullable: false }) _codeId: string,
        @Arg("confirmCode", { nullable: false }) _confirmCode: string,
        @Ctx() ctx: ContextType
    ): Promise<LoginResponse> {

        const publicKeyOwner = _get(ctx, 'key.owner', '');

        try {

            const publicKeyError = _get(ctx, 'key.error', '');
            if (!isEmpty(publicKeyError)) {
                throw new Error(publicKeyError);
            }

            const user = await UserModel.findById(publicKeyOwner);

            const signUserTokens = await createLoginToken(user);

            return { auth2: true, ...signUserTokens };

        }
        catch (error) {
            console.error(error);
            return {
                auth2: false,
                success: false,
                message: error.message,
            };
        }
    }

    // captcha code middleware
    @Mutation(() => SignUpResponse)
    async signup(
        @Arg('username', () => String, { nullable: false }) username: string,
        @Arg('password', () => String, { nullable: false }) password: string,
        // captcha code
        // @Ctx() {res}: ContextType
    ): Promise<SignUpResponse> {
        log(`SIGNUP: username=${username}`);

        try {
            const createNewAccount = await passwordLogin(username, password, true);
            if (!createNewAccount || !createNewAccount.success) {
                return createNewAccount;
            }

            const mnemonic = _get(createNewAccount, "user.mnemonic", "");
            if (isEmpty(mnemonic)) {
                console.log("Error mnemonic empty")
            }

            // todo queue
            await createInitChatWithAdmin(createNewAccount.user.id || "");

            // todo queue
            await upsertSiteStats({ user: true });

            return {
                ...createNewAccount,
                mnemonic
            }

        }
        catch (error) {
            console.error(error);
            return {
                auth2: false,
                success: false,
                message: error.message,
            };
        }


    }


    @Mutation(() => ForgotPasswordResponse)
    async forgotPassword(
        @Arg('username', () => String, { nullable: false }) username: string,
        // captcha code
        // @Ctx() {res}: ContextType
    ): Promise<ForgotPasswordResponse> {
        log(`FORGOT_PASSWORD: username=${username}`);

        try {
            const [errorUser, allUsers] = await awaitTo(UserModel.pagination({
                where: {
                    username: username.toLowerCase(),
                },
                limit: 1
            }));

            if (errorUser || isEmpty(allUsers)) {
                throw new Error("User not found, please sign up");
            }

            const user = allUsers[0];

            const userId = user.id || "";

            const verifiedKey = await getVerifiedKey(userId);
            if (!verifiedKey) {
                log("User has not verified key")
            };

            const has2Auth = !isEmpty(verifiedKey);
            if (has2Auth) {
                const newPgpCode = await generatePgpCode(verifiedKey.id || "", 300 * 4); // 20 min pgp

                return {
                    userId,
                    auth2: true,
                    success: true,
                    encryptedCode: newPgpCode?.encryptedCode,
                    codeId: newPgpCode?.id,
                }
            }

            return {
                userId,
                success: true,
                useMnemonic: true
            }

        }
        catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.message,
            };
        }


    }

    @UseMiddleware(MnemonicMiddleware())
    @UseMiddleware(PgpCodeMiddleware())
    @Mutation(() => ResType)
    async forgotPasswordConfirm(
        @Arg('userId', () => String, { nullable: false }) userId: string,
        @Arg('mnemonic', () => String, { nullable: true }) mnemonic: string,
        @Arg("codeId", { nullable: true }) _codeId: string,
        @Arg("confirmCode", { nullable: true }) confirmCode: string,
        @Ctx() ctx: ContextType
    ): Promise<ResType> {

        const isMnemonic = !isEmpty(mnemonic);
        log(`FORGOT_PASSWORD_CONFIRM: isMnemonic=${isMnemonic}, mnemonic=${mnemonic}`);

        const publicKeyError = _get(ctx, 'key.error', '');
        const mnemonicVerified = _get(ctx, 'mnemonic.verified', false);
        const mnemonicVerifiedError = _get(ctx, 'mnemonic.error', "");


        const signInUser = async (): Promise<ResType> => {
            const [errorUser, allUsers] = await awaitTo(UserModel.findById(userId));
            if (errorUser || isEmpty(allUsers)) {
                throw new Error("User not found, please sign up");
            }

            return { success: true };
        }

        try {


            if (isMnemonic) {

                if (!mnemonicVerified) {
                    throw new Error(mnemonicVerifiedError);
                }
                // matches login, reset pw
                return await signInUser();
            }

            if (!isMnemonic && confirmCode) {
                // 2FA
                if (!isEmpty(publicKeyError)) {
                    throw new Error(publicKeyError);
                }
                // matches login, reset pw
                return await signInUser();
            }

            throw new Error("Error resetting password")

        }
        catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.message,
            };
        }


    }

    @UseMiddleware(PgpCodeMiddleware())
    @UseMiddleware(MnemonicMiddleware())
    @Mutation(() => LoginResponse)
    async passwordReset(
        @Arg('userId', () => String, { nullable: false }) userId: string,
        @Arg("newPassword", { nullable: false }) newPassword: string,
        @Arg('mnemonic', () => String, { nullable: true }) mnemonic: string,
        @Arg("codeId", { nullable: true }) _codeId: string,
        @Arg("confirmCode", { nullable: true }) confirmCode: string,
        @Ctx() ctx: ContextType
    ): Promise<LoginResponse> {

        const isMnemonic = !isEmpty(mnemonic);
        log(`PASSWORD_RESET: isMnemonic=${isMnemonic}`);

        const publicKeyError = _get(ctx, 'key.error', '');
        const mnemonicVerified = _get(ctx, 'mnemonic.verified', false);


        const changeUserPassword = async (): Promise<LoginResponse> => {

            const [errorUser, user] = await awaitTo(UserModel.findById(userId));
            if (errorUser || isEmpty(user)) {
                throw new Error("User not found");
            }

            const newPasswordHash = await argon2.hash(newPassword);

            const [errorUpdate, updatedUser] = await awaitTo(UserModel.updateById(userId, {
                ...user,
                hash: newPasswordHash
            }));

            if (errorUpdate || isEmpty(updatedUser)) {
                throw new Error("Error updating password");
            }

            const signUserTokens = await createLoginToken(user);

            return { ...signUserTokens, auth2: !isMnemonic };
        }

        try {

            if (isEmpty(userId)) {
                throw new Error("User id is empty");
            }

            if (isEmpty(newPassword)) {
                throw new Error("New password is empty");
            }

            if (isMnemonic) {
                if (!mnemonicVerified) {
                    throw new Error("Mnemonic does not match");
                }
                // matches update password
                return changeUserPassword();
            } else if (!isMnemonic && confirmCode) {
                // 2FA
                if (!isEmpty(publicKeyError)) {
                    throw new Error(publicKeyError);
                }
                // matches update password
                return await changeUserPassword();
            }

            throw new Error("Error resetting password")

        }
        catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.message,
            };
        }


    }

}

export default UserAuthResolver;
