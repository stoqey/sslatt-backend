import {
  Arg,
  Query,
  Resolver,
  UseMiddleware,
  Mutation,
} from "type-graphql";

import _get from "lodash/get";
import { isAuth } from "@roadmanjs/auth"
import { ContextType, Ctx, ResType } from "couchset";
import { PgpPublicKey, PgpPublicKeyModel } from "./Pgp.model";
import { generatePgpCode, verifyCode } from "./Pgp.methods";
import { PgpCodeMiddleware } from "./pgpCode.middleware";
import { log } from "console";
import { awaitTo } from "couchset/dist/utils";
import { isEmpty } from "lodash";

// TODO to @roadmanjs/auth
@Resolver()
export class PgpResolver {
  // getNewCode 
  // {codeId, encryptedCode} ===> 

  // verifyCodeMiddleware
  // <----------------- {codeId, encryptedCode, confirmCode}



  // addNewKey - verifyNewKey
  /**
   * NEW
   * <--publicKey (client post)
   * -----> sign with code (server response)
   * <----- confirmCode (client post)
   * -----> saveKey
   * 
   * REPLACE
   * if key exists
   * -----> sign with code with old key
   * <----- confirmCode (client post)
   * -----> saveKey
   */


  /**
   *                CLIENT                                          SERVER
   * addNewKey    (publicKey)                          <------ (codeId, encryptedCode)     
   * verifyNewKey (codeId, encryptedCode, confirmCode) <------ (success,error,verifiedKey)
   */

  @Query(() => PgpPublicKey, { nullable: true })
  @UseMiddleware(isAuth)
  async getPgpKey(@Ctx() ctx: ContextType): Promise<PgpPublicKey | null> {
    try {

      const owner = _get(ctx, 'payload.userId', '');

      const [_errorAllExisting, allExistingPubKey] = await awaitTo(PgpPublicKeyModel.pagination({
        where: {
          owner,
          verified: true
        },
        limit: 1
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
      console.error(error && error.message, error);
      return null;
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async addNewKey(@Ctx() ctx: ContextType, @Arg("publicKey") publicKey: string): Promise<ResType> {
    try {
      const owner = _get(ctx, 'payload.userId', '');

      // TODO validate public key

      const newPublicKey: PgpPublicKey = {
        key: publicKey,
        owner,
        verified: false
      };

      let newPubKey, isVerified;

      const [_errorAllExisting, allExistingPubKey] = await awaitTo(PgpPublicKeyModel.pagination({
        where: {
          owner
        }
      }));

      isVerified = allExistingPubKey?.some((key) => key.verified);

      if (allExistingPubKey?.length && isVerified) {

        const oldKey = allExistingPubKey.find((key) => key.verified);
        if (!oldKey) {
          throw new Error("error finding old key");
        }

        // is newKey
        const [_errorExisting, existingPubKey] = await awaitTo(PgpPublicKeyModel.pagination({
          where: {
            key: publicKey
          }
        }));

        if (!isEmpty(existingPubKey)) {
          throw new Error("public key already exists, add a new one");
        };

        const oldPublicKey = oldKey.key;
        if (publicKey.replace(/(?:\r\n|\r|\n)/g, '') === oldPublicKey.replace(/(?:\r\n|\r|\n)/g, '')) {
          throw new Error("public key already exists, add a new one");
        }

        // save new key
        newPubKey = await PgpPublicKeyModel.create(newPublicKey);
        if (!newPubKey) {
          throw new Error("error adding new public key");
        }
        // console.log("newPubKey", newPubKey)

        // create new code
        const newPgpCode = await generatePgpCode(newPubKey.id);
        log("newPgpCode", newPgpCode?.value);

        const oldPgpCode = await generatePgpCode(oldKey.id);
        log("oldPgpCode", oldPgpCode?.value);

        if (!newPgpCode || !oldPgpCode) {
          throw new Error("error saving new verification codes");
        }

        // 2 codes (old and new)
        return {
          success: true,
          data: {
            // meta and render
            oldPublicKey: oldKey,
            newPublicKey,
            newCodeId: newPgpCode.id,
            newEncryptedCode: newPgpCode.encryptedCode,
            oldCodeId: oldPgpCode.id,
            oldEncryptedCode: oldPgpCode.encryptedCode,
          }
        }

      } else {
        // create new key

        const [_errorExisting, existingPubKey] = await awaitTo(PgpPublicKeyModel.pagination({
          where: {
            key: publicKey
          }
        }));

        if (existingPubKey && !isEmpty(existingPubKey)) {
          newPubKey = existingPubKey[0]
        } else {
          newPubKey = await PgpPublicKeyModel.create(newPublicKey);
        }

        if (!newPubKey) {
          throw new Error("error adding public key");
        }

        // create new code
        const pgpCode = await generatePgpCode(newPubKey.id);
        log("pgpCode", pgpCode?.value);

        if (!pgpCode) {
          throw new Error("error saving verification code");
        }

        // log("pgpCode", pgpCode);

        return {
          success: true,
          data: {
            // meta and render
            publicKey: newPublicKey,
            codeId: pgpCode.id,
            encryptedCode: pgpCode.encryptedCode,
          }
        }
      }
    } catch (err) {
      console.error(err && err.message, err);
      return { success: false, message: err && err.message };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  @UseMiddleware(PgpCodeMiddleware())
  async verifyNewKey(
    @Ctx() ctx: ContextType,
    @Arg("codeId", { nullable: false }) _codeId: string,
    @Arg("newCodeId", { nullable: true }) newCodeId: string,
    @Arg("confirmCode", { nullable: false }) _confirmCode: string,
    @Arg("newConfirmCode", { nullable: true }) newConfirmCode: string,
  ): Promise<ResType> {
    try {
      const isNewKey = isEmpty(newCodeId) && isEmpty(newConfirmCode);

      console.log("isNewKey", isNewKey);

      const publicKeyId = _get(ctx, 'key.id', '');
      const publicKeyError = _get(ctx, 'key.error', '');
      if (!isEmpty(publicKeyError)) {
        throw new Error(publicKeyError);
      }

      if (!isNewKey) {

        const newVerifiedPubKey = await verifyCode(newCodeId, newConfirmCode);
        const newPubKeyId = newVerifiedPubKey.id || "";
        // log("newVerifiedPubKey", newVerifiedPubKey);

        if (!newVerifiedPubKey || isEmpty(newPubKeyId)) {
          throw new Error("error verifying new code");
        }

        const updatedNewPubKey = await PgpPublicKeyModel.updateById(newPubKeyId, {
          ...newVerifiedPubKey,
          verified: true
        });

        const deletedOldPubKey = await PgpPublicKeyModel.delete(publicKeyId);
        // log("deletedOldPubKey", deletedOldPubKey);

        return {
          success: true,
          data: {
            publicKey: updatedNewPubKey,
          }
        }
      }

      const pubKey = await PgpPublicKeyModel.findById(publicKeyId);
      const updatedPubKey = await PgpPublicKeyModel.updateById(publicKeyId, {
        ...pubKey,
        verified: true
      });

      return {
        success: true,
        data: {
          publicKey: updatedPubKey,
        }
      }

    } catch (err) {
      console.error(err && err.message, err);
      return { success: false, message: err && err.message };
    }
  }
}

export default PgpResolver;
