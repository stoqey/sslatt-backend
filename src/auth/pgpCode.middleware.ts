import * as _firebase from 'firebase-admin';

import { UserModel, argonVerifyHash } from '@roadmanjs/auth';

import { MiddlewareFn } from 'couchset';
import _get from 'lodash/get';
import { awaitTo } from 'couchset/dist/utils';
import isEmpty from 'lodash/isEmpty';
import { log } from '@roadmanjs/logs';
import { verifyCode } from './Pgp.methods';

export const PgpCodeMiddleware = (): MiddlewareFn => {
    return async ({ args, context }: any, next) => {

        const code = args.codeId;
        const confirmCode = args.confirmCode;

        try {

            if (isEmpty(code)) {
                throw new Error('Code is empty');
            }

            if (isEmpty(confirmCode)) {
                throw new Error('ConfirmCode is empty');
            }


            const [errorVerifiedKey, verifiedPublicKeyId] = await awaitTo(verifyCode(code, confirmCode));

            if (errorVerifiedKey) {
                throw errorVerifiedKey;
            }

            if (!verifiedPublicKeyId) {
                throw new Error('ConfirmCode is invalid');
            }

            context.key = verifiedPublicKeyId;

        } catch (err) {
            log("Error verifying pgp code", err);
            context.key = {
                error: err.message
            };
        }
        return next();
    };
};

export const MnemonicMiddleware = (): MiddlewareFn => {
    return async ({ args, context }: any, next) => {

        const userId = _get(context, "payload.userId", args.userId);
        const mnemonic = (args.mnemonic || "").toLowerCase();
        console.log("MnemonicMiddleware", mnemonic);

        try {

            if (isEmpty(userId)) {
                throw new Error('User ID is empty');
            }

            if (isEmpty(mnemonic)) {
                throw new Error('Mnemonic is empty');
            }

            const [errorUser, user] = await awaitTo(UserModel.findById(userId));

            if (errorUser || isEmpty(user)) {
                throw new Error("User not found");
            }

            if (isEmpty(user.mnemonicHash) || !user.mnemonicHash) {
                throw new Error("User does not have a mnemonic code")
            }

            console.log("user.mnemonicHash", user.mnemonicHash);

            const mnemonicMatch = await argonVerifyHash(user.mnemonicHash, mnemonic)
            if (!mnemonicMatch) {
                throw new Error("Mnemonic does not match");
            }

            context.mnemonic = {
                userId,
                verified: true
            };

        } catch (err) {
            log("Error verifying mnemonic code", err);
            context.mnemonic = {
                error: err.message
            };
        }
        return next();
    };
};
