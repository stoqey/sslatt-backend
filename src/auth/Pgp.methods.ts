import * as openpgp from 'openpgp';

import { PgpPublicKey, PgpPublicKeyCode, PgpPublicKeyCodeModel } from './Pgp.model';

import { PgpPublicKeyModel } from './Pgp.model';
import { awaitTo } from 'couchset/dist/utils';
import { isEmpty } from 'lodash';
import { log } from 'console';

export const verifyCode = async (codeId: string, confirmCode: string): Promise<PgpPublicKey> => {

    const [_errorPgpCode, pgpCode] = await awaitTo<PgpPublicKeyCode>(PgpPublicKeyCodeModel.findById(codeId));
    if (!pgpCode || !pgpCode.publicKeyId) {
        throw new Error('Code not found or expired')
    }

    const [_error, updatedPgpCode] = await awaitTo(PgpPublicKeyModel.findById(pgpCode.publicKeyId));

    if (isEmpty(updatedPgpCode)) {
        throw new Error('Key not found expired')
    }

    if (pgpCode.value !== confirmCode) {

        // TODO add attempts limit, lock account
        const attempts = (pgpCode.attempts || 0) + 1;

        // this might key expired timestamp
        await PgpPublicKeyCodeModel.updateById(codeId, {
            ...pgpCode,
            attempts
        });

        throw new Error(`Confirm code is invalid ${attempts > 1 ? `(${attempts} attempts)` : ''}`);
    }

    return updatedPgpCode;

}


export const generateCodeNumber = () => {
    return Math.floor(100000 + Math.random() * 900000);
};

export async function encryptCode(keyId: string, code: string): Promise<string | null> {
    try {

        const existingPublicKey = await PgpPublicKeyModel.findById(keyId);
        if (!existingPublicKey) {
            throw new Error("Key not found");
        }

        let publicKeyArmored = existingPublicKey.key;
        // publicKeyArmored = publicKeyArmored.replace(/(\r\n|\n|\r)/gm, "");

        if (!publicKeyArmored || isEmpty(publicKeyArmored)) {
            throw new Error("Key not found");
        }

        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: code }), // input as Message object
            encryptionKeys: publicKey,
        });

        return encrypted as string;
    }
    catch (error) {
        log("error encrypting code", error);
        return null;
    }
}

export const generatePgpCode = async (publicKeyId: string, expiry = 300): Promise<PgpPublicKeyCode | null> => {
    try {

        const randomCode = generateCodeNumber();
        // log("randomCode", randomCode);

        const encryptedCode = await encryptCode(publicKeyId, `${randomCode}`);
        // log("encryptedCode", encryptedCode);

        if (!encryptedCode) {
            throw new Error("error encrypting code");
        }

        const temporaryCode: PgpPublicKeyCode = {
            publicKeyId,
            encryptedCode,
            value: randomCode + "",
        }

        // delete temCode in 5 min
        const temCode = await PgpPublicKeyCodeModel.create(temporaryCode, { expiry });
        return temCode;

    }
    catch (error) {
        log("error generating pgp code", error);
        return null;
    }


}

export const getVerifiedKey = async (owner: string): Promise<PgpPublicKey | null> => {
    try {
        const [_errorAllExisting, allExistingPubKey] = await awaitTo(PgpPublicKeyModel.pagination({
            where: {
                owner,
                verified: true
            }
        }));

        if (_errorAllExisting) {
            throw _errorAllExisting;
        }

        if (!isEmpty(allExistingPubKey) && allExistingPubKey) {
            return allExistingPubKey[0];
        }

        throw new Error("Key not found");
    }
    catch (error) {
        console.log("error getting verified key", error);
        return null;
    }
}