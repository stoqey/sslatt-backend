import {
  Resolver,
  Query,
  Mutation,
  Arg,
  UseMiddleware,
  Ctx
} from "type-graphql";
import { awaitTo } from "@stoqey/client-graphql";
import {
  ContextType,
  CouchbaseConnection,
  createUpdate,
  ResType,
} from "couchset";
import _get from "lodash/get";
import identity from "lodash/identity";
import pickBy from "lodash/pickBy";
import WithdrawRequestModel, { WithdrawRequestModelName, WithdrawRequestStatus, WithdrawRequest, WithdrawRequestOutputPagination, WithdrawRequestOutput } from "./withdrawRequest.model";
import { log } from "@roadmanjs/logs";
import { UserModel, isAuth } from "@roadmanjs/auth";
import { isEmpty } from "lodash";
import { WalletModel, updateWallet, createTransactions } from "@roadmanjs/wallet";
import { isDev } from "../config";
import { verifyBtcAddress } from "./withdrawRequest.methods";
import { getSiteSettings } from "../settings/settings.methods";


@Resolver()
export class WithdrawRequestResolver {

  @Query(() => WithdrawRequestOutputPagination)
  @UseMiddleware(isAuth)
  async myWithdrawRequests(
    @Ctx() ctx: ContextType,
    @Arg('filter', () => String, { nullable: true }) filter?: string,
    @Arg('sort', () => String, { nullable: true }) sortArg?: string,
    @Arg('before', () => Date, { nullable: true }) before?: Date,
    @Arg('after', () => Date, { nullable: true }) after?: Date,
    @Arg('limit', () => Number, { nullable: true }) limitArg?: number
  ): Promise<{ items: WithdrawRequestOutput[]; hasNext?: boolean; params?: any }> {
    const owner = _get(ctx, 'payload.userId', '');
    const bucket = CouchbaseConnection.Instance.bucketName;
    const sign = before ? '<=' : '>=';
    const time = new Date(before || after || new Date());
    const sort = sortArg || 'DESC';
    const limit = limitArg || 10;
    const limitPassed = limit + 1; // adding +1 for hasNext

    const copyParams = pickBy(
      {
        sort,
        filter,
        before,
        after,
        owner,
        limit,
      },
      identity
    );

    try {
      const query = `
              SELECT *
                  FROM \`${bucket}\` requests
                  JOIN \`${bucket}\` owner ON KEYS requests.owner
                  WHERE requests._type = "${WithdrawRequestModelName}"
                    AND requests.owner = "${owner}"
                    AND requests.createdAt ${sign} "${time.toISOString()}"
                  ORDER BY requests.createdAt ${sort}
                  LIMIT ${limitPassed};
              `;

      const [errorFetching, data = []] = await awaitTo(
        WithdrawRequestModel.customQuery<any>({
          limit: limitPassed,
          query,
          params: copyParams,
        })
      );

      if (errorFetching) {
        throw errorFetching;
      }

      const [rows = []] = data;

      const hasNext = rows.length > limit;

      if (hasNext) {
        rows.pop(); // remove last element
      }

      const dataToSend = rows.map((d) => {
        const { requests } = d;
        const owner = d.owner ? UserModel.parse(d.owner) : null;
        return WithdrawRequestModel.parse({ ...requests, owner });
      });

      return { items: dataToSend, params: copyParams, hasNext };
    } catch (error) {
      log('error getting withdraw requests', error);
      return { items: [], hasNext: false, params: copyParams };
    }
  }

  @Query(() => WithdrawRequestOutput, { nullable: true })
  @UseMiddleware(isAuth)
  async withdrawRequestById(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) withdrawRequestId: string
  ): Promise<WithdrawRequestOutput | null> {
    const owner = _get(ctx, 'payload.userId', '');
    const bucket = CouchbaseConnection.Instance.bucketName;

    try {
      const query = `
              SELECT *
                  FROM \`${bucket}\` requests
                  JOIN \`${bucket}\` owner ON KEYS requests.owner
                  WHERE requests.id = "${withdrawRequestId}"
                  ;
              `;

      const [errorFetching, data = []] = await awaitTo(
        WithdrawRequestModel.customQuery<any>({
          limit: 1,
          query,
          params: { withdrawRequestId },
        })
      );

      if (errorFetching) {
        throw errorFetching;
      }

      // TODO check if is owner or admin

      const [rows = []] = data;
      if (!rows.length) {
        throw new Error('Withdraw request not found');
      }

      const row = rows[0];
      const owner = row.owner ? UserModel.parse(row.owner) : null;
      const { requests } = row;

      return WithdrawRequestModel.parse({ ...requests, owner })

    } catch (error) {
      log('error getting withdraw request', error);
      return null;
    }
  }

  @Mutation(() => ResType, { nullable: true })
  @UseMiddleware(isAuth)
  async createWithdrawRequestByWallet(
    @Ctx() ctx: ContextType,
    @Arg("args", () => WithdrawRequest, { nullable: false }) withdrawRequest: WithdrawRequest
  ): Promise<ResType> {
    const owner = _get(ctx, 'payload.userId', '');
    const requireAdmin = isDev; // TODO from site settings
    // does user have balance from wallet
    // create withdrawRequest
    // remove user balance -> create user transaction
    // notify user

    // auto
    // use api to finalize withdrawRequest

    // manual use admin to finalize withdrawRequest
    // -----> admin can finalize withdrawRequest on behalf of user -> use api to finalize withdrawRequest

    log("createWithdrawRequestByWallet", { withdrawRequest, requireAdmin });
    try {
      const { type: withdrawType = "crypto", receiver = "", amount = 0, currency = "", walletId = "" } = withdrawRequest;

      const siteSettings = await getSiteSettings();
      const feePrices = siteSettings?.feePrices;
      if (!siteSettings || !feePrices) {
        throw new Error("Internal error, please contact support")
      };
     
      const feePerc = feePrices.withdrawFeePerc;
      const feeAmount = (feePerc / 100) * amount;
      const amountToRemove = amount - feeAmount;

      if (isEmpty(walletId)) {
        throw new Error("walletId must be defined")
      }

      if (isEmpty(currency)) {
        throw new Error("currency must be defined")
      }

      if (isEmpty(receiver)) {
        throw new Error("Receiver must be defined")
      }

      // TODO other currencies
      const isValidReceiver = verifyBtcAddress(receiver);
      if (!isValidReceiver) {
        throw new Error("Receiver address is not valid")
      }

      const wallet = await WalletModel.findById(walletId);

      if (!wallet) {
        throw new Error("Wallet not found")
      }

      // wallet has amount, currency
      if (currency !== wallet.currency) {
        throw new Error(`currency(${currency}) not the same as wallet(${wallet.currency}})`)
      }

      type FeeKeyType = keyof typeof feePrices.withdrawMin;
      const minCurrencyAmount = feePrices.withdrawMin[currency as FeeKeyType] || 0;
      const feeAmountMinCurrency = (feePerc / 100) * minCurrencyAmount;

      if (amount < (minCurrencyAmount + feeAmountMinCurrency)) {
        throw new Error("amount has to be greater than " + (minCurrencyAmount + feeAmountMinCurrency))
      }

      if (amount > wallet.amount) {
        throw new Error("funds not enough from wallet")
      }

      let transactionHash = "";

      if (!requireAdmin) {
        // create btc request
        const [error, createdTransaction] = await awaitTo(
          createTransactions(currency, [
            { amount: "" + amountToRemove, destination: receiver, subtractFromAmount: true }
          ]));

        if (error) {
          throw error;
        }

        if (isEmpty(createdTransaction)) {
          throw new Error("Error creating withdraw transaction")
        }
        transactionHash = createdTransaction.transactionHash;
      }


      // create request
      const newRequest: WithdrawRequest = {
        walletId,
        owner: owner,
        type: withdrawType,
        transactionHash,
        // automatic approval
        status: requireAdmin ? WithdrawRequestStatus.requested : WithdrawRequestStatus.accepted,
        receiver,
        amount,
        currency,
        feePerc
      }

      const createdWithdrawRequest = await createUpdate<WithdrawRequest>({
        model: WithdrawRequestModel,
        data: {
          ...newRequest as any,
        },
        ...newRequest as any, // id and owner if it exists
      });

      // repeated in create transaction
      // returns { wallet, transaction }
      const updatedUserBalance = await updateWallet({
        owner,
        amount: -amount,
        source: WithdrawRequestModelName,
        sourceId: createdWithdrawRequest.id,
        currency,
        // message: `Withdraw request ${createdWithdrawRequest.id}`,
      });

      if (!updatedUserBalance.transaction) {
        throw new Error("Error creating transaction")
      }

      // TODO notify user use updatedUserBalance.transaction

      return { data: createdWithdrawRequest, success: true };

    } catch (error) {
      log('error creating withdraw request', error);
      return { success: false, message: error.message };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async cancelWithdrawRequest(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) withdrawRequestId: string,
    @Arg('reason', () => String, { nullable: true, defaultValue: "" }) reason?: string,
  ): Promise<ResType> {
    const owner = _get(ctx, 'payload.userId', '');
    /**
     if is owner is creator
     if is admin
     */

    try {
      const currentWithdrawRequestId = await WithdrawRequestModel.findById(withdrawRequestId);

      // if (owner !== currentWithdrawRequestId.owner) {
      //   throw new Error("You are not the owner of this withdraw")
      // }

      if (currentWithdrawRequestId.status !== WithdrawRequestStatus.requested) {
        throw new Error("You cannot cancel this withdraw request")
      }

      const updateOrder = await WithdrawRequestModel.updateById(withdrawRequestId, {
        ...currentWithdrawRequestId,
        status: WithdrawRequestStatus.cancelled,
        reason
      });

      return { success: true, data: updateOrder };

    } catch (error) {
      log('error cancelling withdraw request', error);
      return { success: false, message: error.message };
    }
  }

}

export default WithdrawRequestResolver;
