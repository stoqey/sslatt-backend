import { Resolver, Mutation, Arg, UseMiddleware, Field, ObjectType, ContextType, Ctx, ResType } from 'couchset';
import { log } from '@roadmanjs/logs';
import { UserModel, argonVerifyHash, isAuth } from '@roadmanjs/auth';
import { generatePgpCode, getVerifiedKey } from './Pgp.methods';
import { MnemonicMiddleware, PgpCodeMiddleware } from './pgpCode.middleware';
import _get from 'lodash/get';
import { isEmpty } from 'lodash';
import { awaitTo } from 'couchset/dist/utils';
import argon2 from 'argon2';

@ObjectType()
class PasswordChangeResponse {
    @Field(() => Boolean, { nullable: true })
    useMnemonic?: boolean;

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
export class UserAuthPwResolver {

    @UseMiddleware(isAuth)
    @Mutation(() => PasswordChangeResponse)
    async passwordChange(
        @Ctx() ctx: ContextType
    ): Promise<PasswordChangeResponse> {

        try {
            const userId = _get(ctx, 'payload.userId', '');

            const [errorUser, user] = await awaitTo(UserModel.findById(userId));

            if (errorUser || isEmpty(user)) {
                throw new Error("User not found, please sign up");
            }

            const verifiedKey = await getVerifiedKey(userId);
            if (!verifiedKey) {
                log("User has not verified key")
            };

            const has2Auth = !isEmpty(verifiedKey);
            if (has2Auth) {
                const newPgpCode = await generatePgpCode(verifiedKey.id || "");

                return {
                    auth2: true,
                    success: true,
                    encryptedCode: newPgpCode?.encryptedCode,
                    codeId: newPgpCode?.id,
                    useMnemonic: false
                }
            }

            return {
                auth2: false,
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

    @UseMiddleware(isAuth)
    @UseMiddleware(PgpCodeMiddleware())
    @UseMiddleware(MnemonicMiddleware())
    @Mutation(() => ResType)
    async passwordChangeConfirm(
        @Arg("oldPassword", { nullable: false }) oldPassword: string,
        @Arg("newPassword", { nullable: false }) newPassword: string,
        @Arg('mnemonic', () => String, { nullable: true }) mnemonic: string,
        @Arg("codeId", { nullable: true }) _codeId: string,
        @Arg("confirmCode", { nullable: true }) confirmCode: string,
        @Ctx() ctx: ContextType
    ): Promise<ResType> {
        const userId = _get(ctx, 'payload.userId', '');
        const isMnemonic = !isEmpty(mnemonic);
        log(`PASSWORD_RESET: isMnemonic=${isMnemonic}`);

        const publicKeyError = _get(ctx, 'key.error', '');
        const mnemonicVerified = _get(ctx, 'mnemonic.verified', false);

        try {

            const changeUserPassword = async (): Promise<ResType> => {

                const [errorUser, user] = await awaitTo(UserModel.findById(userId));
                if (errorUser || isEmpty(user)) {
                    throw new Error("User not found");
                }

                const isOldPwValid = await argonVerifyHash(user.hash, oldPassword);
                if (!isOldPwValid) {
                    throw new Error("Old password is invalid");
                }

                const isNewPwOldPw = await argonVerifyHash(user.hash, newPassword);
                if (isNewPwOldPw) {
                    throw new Error("New password cannot be the same as old password");
                }

                const newPasswordHash = await argon2.hash(newPassword);
                const [errorUpdate, updatedUser] = await awaitTo(UserModel.updateById(userId, {
                    ...user,
                    hash: newPasswordHash
                }));

                if (errorUpdate || isEmpty(updatedUser)) {
                    throw new Error("Error updating password");
                }

                return {
                    success: true,
                    message: "Password updated",
                };
            }

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
                return await changeUserPassword();
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

export default UserAuthPwResolver;
