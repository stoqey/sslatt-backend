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
import { Dispute, DisputeOutputPagination, DisputeOutput, DisputeModel } from "./dispute.model";
import { log } from "@roadmanjs/logs";
import { UserModel, isAuth } from "@roadmanjs/auth";
import { isEmpty } from "lodash";
import { OrderModel, OrderStatus, OrderType } from "../order";
import { RequestStatus } from "../shared";


@Resolver()
export class DisputesResolver {

  @Query(() => DisputeOutputPagination)
  @UseMiddleware(isAuth)
  async myDisputes(
    @Ctx() ctx: ContextType,
    @Arg('filter', () => String, { nullable: true }) filter?: string,
    @Arg('sort', () => String, { nullable: true }) sortArg?: string,
    @Arg('before', () => Date, { nullable: true }) before?: Date,
    @Arg('after', () => Date, { nullable: true }) after?: Date,
    @Arg('limit', () => Number, { nullable: true }) limitArg?: number
  ): Promise<{ items: DisputeOutput[]; hasNext?: boolean; params?: any }> {
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
                  FROM \`${bucket}\` dispute
                  JOIN \`${bucket}\` owner ON KEYS dispute.owner
                  LEFT JOIN \`${bucket}\` seller ON KEYS dispute.seller
                  LEFT JOIN \`${bucket}\` order ON KEYS dispute.order
                  WHERE dispute._type = "${Dispute.name}"
                    AND dispute.owner = "${owner}"
                    AND dispute.createdAt ${sign} "${time.toISOString()}"
                    OR dispute.seller = "${owner}"
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
        rows.pop(); // remove last element
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

  @Query(() => DisputeOutput, { nullable: true })
  @UseMiddleware(isAuth)
  async disputeById(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) disputeId: string
  ): Promise<DisputeOutput | null> {
    const owner = _get(ctx, 'payload.userId', '');
    const bucket = CouchbaseConnection.Instance.bucketName;

    try {
      const query = `
              SELECT *
                  FROM \`${bucket}\` dispute
                  JOIN \`${bucket}\` owner ON KEYS dispute.owner
                  LEFT JOIN \`${bucket}\` seller ON KEYS dispute.seller
                  LEFT JOIN \`${bucket}\` order ON KEYS dispute.order
                  WHERE dispute.id = "${disputeId}"
                  ;
              `;

      const [errorFetching, data = []] = await awaitTo(
        DisputeModel.customQuery<any>({
          limit: 1,
          query,
          params: { disputeId },
        })
      );

      if (errorFetching) {
        throw errorFetching;
      }

      // TODO check if is owner or admin

      const [rows = []] = data;
      if (!rows.length) {
        throw new Error('Dispute not found');
      }

      const row = rows[0];
      const owner = row.owner ? UserModel.parse(row.owner) : null;
      const seller = row.seller ? UserModel.parse(row.seller) : null;
      const order = row.seller ? OrderModel.parse(row.order) : null;
      const { request } = row;

      return DisputeModel.parse({ ...request, owner, seller, order })

    } catch (error) {
      log('error getting dispute', error);
      return null;
    }
  }

  @Mutation(() => ResType, { nullable: true })
  @UseMiddleware(isAuth)
  async createDispute(
    @Ctx() ctx: ContextType,
    @Arg("args", () => Dispute, { nullable: false }) dispute: Dispute
  ): Promise<ResType> {
    const owner = _get(ctx, 'payload.userId', '');


    try {
      const { order: orderId = "" } = dispute;
      if (isEmpty(orderId)) {
        throw new Error("Order is required");
      }
      // check if order exists
      // - check order status

      // check if order is not disputed
      const [errorCurrentOrder, currentOrder] = await awaitTo<OrderType>(OrderModel.findById(orderId as string));
      if (errorCurrentOrder) {
        throw errorCurrentOrder;
      }
      if (!currentOrder) {
        throw new Error("Order not found");
      }

      // TODO status
      if (currentOrder.status !== OrderStatus.completed) {
        throw new Error("Order is not completed");
      }

      const disputeExists = await DisputeModel.pagination({
        where: {
          order: orderId
        }
      });

      if (disputeExists.length) {
        throw new Error("Dispute already exists for this order");
      }

      const newDispute = {
        order: orderId,
        owner,
        seller: currentOrder.seller,
        status: RequestStatus.requested,
      }

      const createdDispute = await DisputeModel.create(newDispute);
      return { success: true, data: createdDispute };

    }
    catch (error) {
      log('error creating dispute', error);
      return { success: false, message: error.message };
    }

  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async cancelDispute(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) disputeId: string,
    @Arg('reason', () => String, { nullable: true, defaultValue: "" }) reason?: string,
  ): Promise<ResType> {
    const owner = _get(ctx, 'payload.userId', '');
    /**
     if is owner is creator
     if is admin
     */

    try {
      const currentDisputeId = await DisputeModel.findById(disputeId);

      if (!currentDisputeId) {
        throw new Error("Dispute not found");
      }

      if (currentDisputeId.owner !== owner) {
        throw new Error("You cannot cancel this dispute");
      }

      // TODO status
      if (currentDisputeId.status !== RequestStatus.requested) {
        throw new Error("You cannot cancel this dispute")
      }

      const updateOrder = await DisputeModel.updateById(disputeId, {
        ...currentDisputeId,
        status: RequestStatus.cancelled,
        reason
      });

      return { success: true, data: updateOrder };

    } catch (error) {
      log('error cancelling dispute', error);
      return { success: false, message: error.message };
    }
  }

}

export default DisputesResolver;
