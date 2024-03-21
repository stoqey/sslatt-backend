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
import WithdrawRequestModel, { WithdrawRequestModelName, WithdrawRequestPagination, WithdrawRequestOutput, WithdrawRequestOutputPagination, WithdrawRequestStatus, WithdrawRequest } from "./withdrawRequest.model";
import { log } from "@roadmanjs/logs";
import { isAdmin, isAuth } from "@roadmanjs/auth";
import { confirmWithdrawRequest } from "./withdrawRequest.methods";

@Resolver()
export class WithdrawRequestAdminResolver {

  @Query(() => WithdrawRequestOutputPagination)
  @UseMiddleware(isAuth)
  @UseMiddleware(isAdmin)
  async allWithdrawRequests(
    @Arg('filter', () => String, { nullable: true }) filter?: string,
    @Arg('sort', () => String, { nullable: true }) sortArg?: string,
    @Arg('before', () => Date, { nullable: true }) before?: Date,
    @Arg('after', () => Date, { nullable: true }) after?: Date,
    @Arg('limit', () => Number, { nullable: true }) limitArg?: number
  ): Promise<{ items: WithdrawRequestOutput[]; hasNext?: boolean; params?: any }> {
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
        limit,
      },
      identity
    );

    try {
      const query = `
              SELECT *
                  FROM \`${bucket}\` requests
                  LEFT JOIN \`${bucket}\` owner ON KEYS requests.owner
                  LEFT JOIN \`${bucket}\` wallet ON KEYS requests.walletId
                  WHERE requests._type = "${WithdrawRequestModelName}"
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
        rows.pop();
      }

      const dataToSend = rows.map((d) => {
        const { requests, owner, wallet } = d;
        return WithdrawRequestModel.parse({ ...requests, owner, wallet });
      });

      return { items: dataToSend, params: copyParams, hasNext };
    } catch (error) {
      log('error getting withdraw requests', error);
      return { items: [], hasNext: false, params: copyParams };
    }
  }


  @Mutation(() => ResType, { description: "Admin can confirm or reject withdraw request" })
  @UseMiddleware(isAuth)
  @UseMiddleware(isAdmin)
  async confirmWithdrawRequest(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) withdrawRequestId: string,
    @Arg('confirm', () => Boolean, { nullable: true, defaultValue: true }) confirm?: boolean,
    @Arg('reason', () => String, { nullable: true, defaultValue: "" }) reason?: string,
  ): Promise<ResType> {
    /**
      * 1. confirm true
      *   - use api to finalize withdraw request
      *   - update request 
      *   - notify owner of request
      
      * 2. confirm false
      *    - add requested amount back to owner account
      *    - notify owner of request
     **/

    try {
      const currentWithdrawRequest = await WithdrawRequestModel.findById(withdrawRequestId);

      if (!currentWithdrawRequest) {
        throw new Error("Withdraw request not found");
      }

      if (confirm) {
        // api to finalize withdraw request
        // notify owner of request
        const finalizedWithdrawRequest = await confirmWithdrawRequest(withdrawRequestId, true);
        if (finalizedWithdrawRequest) {
          return { success: true, data: finalizedWithdrawRequest };
        }
        throw new Error("Error finalizing withdraw request");
      }

      currentWithdrawRequest.status = WithdrawRequestStatus.cancelled;
      currentWithdrawRequest.reason = reason;

      const updateWithdrawRequest = await WithdrawRequestModel.updateById(withdrawRequestId, {
        ...currentWithdrawRequest,
      });

      // notify owner of request cancelled
      return { success: true, data: updateWithdrawRequest };

    } catch (error) {
      log('error confirming withdraw request', error);
      return { success: false, message: error.message };
    }
  }

}

export default WithdrawRequestAdminResolver;
