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
  ResType,
} from "couchset";
import _get from "lodash/get";
import identity from "lodash/identity";
import pickBy from "lodash/pickBy";
import { DisputeOutput, DisputeOutputPagination, Dispute, DisputeModel } from "./dispute.model";
import { log } from "@roadmanjs/logs";
import { UserModel, isAdmin, isAuth } from "@roadmanjs/auth";

import { OrderModel } from "../order";
import { RequestStatus } from "../shared";

@Resolver()
export class DisputeAdminResolver {

  @Query(() => DisputeOutputPagination)
  @UseMiddleware(isAuth)
  @UseMiddleware(isAdmin)
  async allDisputes(
    @Arg('filter', () => String, { nullable: true }) filter?: string,
    @Arg('sort', () => String, { nullable: true }) sortArg?: string,
    @Arg('before', () => Date, { nullable: true }) before?: Date,
    @Arg('after', () => Date, { nullable: true }) after?: Date,
    @Arg('limit', () => Number, { nullable: true }) limitArg?: number
  ): Promise<{ items: DisputeOutput[]; hasNext?: boolean; params?: any }> {
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
                  FROM \`${bucket}\` dispute
                  LEFT JOIN \`${bucket}\` owner ON KEYS dispute.owner
                  LEFT JOIN \`${bucket}\` seller ON KEYS dispute.seller
                  LEFT JOIN \`${bucket}\` order ON KEYS dispute.order
                  WHERE dispute._type = "${Dispute.name}"
                    AND dispute.createdAt ${sign} "${time.toISOString()}"
                  ORDER BY dispute.createdAt ${sort}
                  LIMIT ${limitPassed};
              `;

      const [errorFetching, data = []] = await awaitTo(
        DisputeModel.customQuery<any>({
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
        const { dispute } = d;
        const owner = d.owner ? UserModel.parse(d.owner) : null;
        const seller = d.seller ? UserModel.parse(d.seller) : null;
        const order = d.order ? OrderModel.parse(d.order) : null;
        return DisputeModel.parse({ ...dispute, owner, seller, order });
      });

      return { items: dataToSend, params: copyParams, hasNext };
    } catch (error) {
      log('error getting disputes', error);
      return { items: [], hasNext: false, params: copyParams };
    }
  }


  @Mutation(() => ResType, { description: "Admin can confirm or reject dispute" })
  @UseMiddleware(isAuth)
  @UseMiddleware(isAdmin)
  async confirmDispute(
    @Arg('id', () => String, { nullable: false }) disputeId: string,
    @Arg('confirm', () => Boolean, { nullable: true, defaultValue: true }) confirm?: boolean,
    @Arg('reason', () => String, { nullable: true, defaultValue: "" }) reason?: string,
  ): Promise<ResType> {

    try {
      const currentDispute = await DisputeModel.findById(disputeId);

      if (!currentDispute) {
        throw new Error("dispute not found");
      }

      if (confirm) {
        currentDispute.status = RequestStatus.accepted;
      } else {
        currentDispute.status = RequestStatus.cancelled;
        currentDispute.reason = reason;
      }

      // TODO notify

      const updateDispute = await DisputeModel.updateById(disputeId, {
        ...currentDispute,
      });

      // notify owner of request cancelled
      return { success: true, data: updateDispute };

    } catch (error) {
      log('error confirming dispute', error);
      return { success: false, message: error.message };
    }
  }

  @Mutation(() => ResType, { description: "Admin can finalize or reject dispute" })
  @UseMiddleware(isAuth)
  @UseMiddleware(isAdmin)
  async finalizeDispute(
    @Arg('id', () => String, { nullable: false }) disputeId: string,
    @Arg('confirm', () => Boolean, { nullable: true, defaultValue: true }) confirm?: boolean
  ): Promise<ResType> {
    try {
      const finalizedDispute = await this.finalizeDispute(disputeId, confirm);

      if (!finalizedDispute) {
        throw new Error("dispute not finalized");
      }

      return { success: true, data: finalizedDispute };

    } catch (error) {
      log('error confirming dispute', error);
      return { success: false, message: error.message };
    }
  }

}

export default DisputeAdminResolver;
