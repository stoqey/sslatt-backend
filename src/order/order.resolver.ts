import {
  Resolver,
  Query,
  Mutation,
  Arg,
  UseMiddleware,
  Ctx,
  // Int,
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
import OrderModel, { OrderModelName, OrderType, OrderTypeOutputPagination, OrderTypeOutput, OrderStatus } from "./order.model";
import { log } from "@roadmanjs/logs";
import { UserModel, isAuth } from "@roadmanjs/auth";
import AdsListingModel from "../listing/AdsListing.model";
import { compact, isEmpty } from "lodash";
import { finalizeOrder, refundOrder } from "./order.methods";
import { fetchRates } from "@roadmanjs/wallet/dist/processors/kraken/rates"
import { WalletModel, updateWallet } from "@roadmanjs/wallet";
import OrderRatingModel from "./orderRating.model";
import { encryptCode, getVerifiedKey } from "../auth/Pgp.methods";
import { getSiteSettings } from "../settings/settings.methods";
import { orderNotification } from "./order.notifications";


@Resolver()
export class OrderResolver {

  @Query(() => OrderTypeOutputPagination)
  @UseMiddleware(isAuth)
  async myOrders(
    @Ctx() ctx: ContextType,
    @Arg('filter', () => String, { nullable: true }) filter?: string,
    @Arg('sort', () => String, { nullable: true }) sortArg?: string,
    @Arg('before', () => Date, { nullable: true }) before?: Date,
    @Arg('after', () => Date, { nullable: true }) after?: Date,
    @Arg('limit', () => Number, { nullable: true }) limitArg?: number
  ): Promise<{ items: OrderTypeOutput[]; hasNext?: boolean; params?: any }> {
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
                  FROM \`${bucket}\` orders
                  JOIN \`${bucket}\` owner ON KEYS orders.owner
                  LEFT JOIN \`${bucket}\` seller ON KEYS orders.seller
                  LEFT JOIN \`${bucket}\` product ON KEYS orders.typeId
                  LEFT JOIN \`${bucket}\` sellerRating ON KEYS orders.sellerRating
                  LEFT JOIN \`${bucket}\` ownerRating ON KEYS orders.ownerRating
                  WHERE orders._type = "${OrderModelName}"
                    AND orders.owner = "${owner}"
                    AND orders.createdAt ${sign} "${time.toISOString()}"
                    OR orders.seller = "${owner}"
                  ORDER BY orders.createdAt ${sort}
                  LIMIT ${limitPassed};
              `;

      const [errorFetching, data = []] = await awaitTo(
        OrderModel.customQuery<any>({
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
        const { orders } = d;
        if (orders._type != OrderModelName) return null;
        const owner = d.owner ? UserModel.parse(d.owner) : null;
        const seller = d.seller ? UserModel.parse(d.seller) : null;
        const product = d.product ? AdsListingModel.parse(d.product) : null;
        const ownerRating = d.ownerRating ? OrderRatingModel.parse(d.ownerRating) : null;
        const sellerRating = d.sellerRating ? OrderRatingModel.parse(d.sellerRating) : null;
        return OrderModel.parse({ ...orders, owner, seller, product, ownerRating, sellerRating });
      });

      return { items: compact(dataToSend), params: copyParams, hasNext };
    } catch (error) {
      log('error getting orders', error);
      return { items: [], hasNext: false, params: copyParams };
    }
  }

  @Query(() => OrderTypeOutput, { nullable: true })
  @UseMiddleware(isAuth)
  async orderById(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) orderId?: string
  ): Promise<OrderTypeOutput | null> {
    const owner = _get(ctx, 'payload.userId', '');
    const bucket = CouchbaseConnection.Instance.bucketName;

    try {
      const query = `
              SELECT *
                  FROM \`${bucket}\` orders
                  JOIN \`${bucket}\` owner ON KEYS orders.owner
                  LEFT JOIN \`${bucket}\` seller ON KEYS orders.seller
                  LEFT JOIN \`${bucket}\` product ON KEYS orders.typeId
                  LEFT JOIN \`${bucket}\` sellerRating ON KEYS orders.sellerRating
                  LEFT JOIN \`${bucket}\` ownerRating ON KEYS orders.ownerRating
                  WHERE orders._type = "${OrderModelName}"
                  AND orders.id = "${orderId}"
              `;

      const [errorFetching, data = []] = await awaitTo(
        OrderModel.customQuery<any>({
          limit: 1,
          query,
          params: { orderId },
        })
      );

      if (errorFetching) {
        throw errorFetching;
      }

      const [rows = []] = data;

      const dataToSend = rows.map((d) => {
        const { orders } = d;
        if (orders._type != OrderModelName) return null;

        if (orders.owner !== owner && orders.seller !== owner) {
          throw new Error("Order not found")
        };

        const orderOwner = d.owner ? UserModel.parse(d.owner) : null;
        const seller = d.seller ? UserModel.parse(d.seller) : null;
        const product = d.product ? AdsListingModel.parse(d.product) : null;
        const ownerRating = d.ownerRating ? OrderRatingModel.parse(d.ownerRating) : null;
        const sellerRating = d.sellerRating ? OrderRatingModel.parse(d.sellerRating) : null;

        return OrderModel.parse({ ...orders, owner: orderOwner, seller, product, ownerRating, sellerRating });
      });

      return dataToSend[0];
    } catch (error) {
      log('error getting order by id', error);
      return null;
    }
  }

  @Mutation(() => ResType, { nullable: true })
  @UseMiddleware(isAuth)
  async checkoutOrder(
    @Ctx() ctx: ContextType,
    @Arg("order", () => OrderType, { nullable: false }) order: OrderType,
    @Arg('walletId', () => String, { nullable: false }) walletId: string,
  ): Promise<ResType> {
    // TODO generic error messages 
    const owner = _get(ctx, 'payload.userId', '');

    // does user have balance
    // create order
    // remove user balance -> create user transaction
    // notify seller

    try {

      const { type, typeId = "", orderType, details = "" } = order;
      const quantity = order.quantity || 1;

      if (isEmpty(details)) {
        throw new Error("details must be defined")
      }

      if (isEmpty(typeId)) {
        throw new Error("Type id must be defined")
      }

      const wallet = await WalletModel.findById(walletId);
      if (isEmpty(wallet)) { throw new Error("Wallet not found") }
      const { amount: walletBalance, currency: walletCurrency } = wallet;

      const findRates = await fetchRates(`${walletCurrency}_USD`);
      if (isEmpty(findRates)) { throw new Error("Cannot find rates") }

      const walletRateUsd = findRates?.[0]?.rate || 0;
      const walletBalanceUsd = walletBalance * walletRateUsd;

      const ad = await AdsListingModel.findById(typeId);
      if (!ad) {
        throw new Error("Ad not found")
      }
      if (ad.owner === owner) {
        throw new Error("Cannot checkout own ad")
      }

      const siteSettings = await getSiteSettings();
      if (!siteSettings) {
        throw new Error("Internal error, please contact support")
      };

      const { price: adPriceUsd } = ad;
      const feePerc = siteSettings.feePrices.checkoutFeePerc;
      const priceXQtyUsd = adPriceUsd * quantity;
      const feeUsd = (feePerc / 100) * priceXQtyUsd;
      const orderPriceTotalUsd = priceXQtyUsd + feeUsd;

      const walletAmountToRemove = orderPriceTotalUsd / walletRateUsd;

      if (walletBalanceUsd < orderPriceTotalUsd) { throw new Error("Insufficient balance") }

      const sellerKey = await getVerifiedKey(ad.owner);
      if (!sellerKey || !sellerKey?.id) {
        // TODO this should never happen though
        throw new Error("Seller has not yet added a verified pgp key, please contact seller")
      }

      // never save user address in db
      const encryptedDetails = await encryptCode(sellerKey.id, details);
      if (!encryptedDetails) {
        throw new Error("Failed to encrypt order details")
      }

      const neworder: OrderType = {
        owner,
        type,
        typeId,
        seller: ad.owner,
        status: OrderStatus.requested,
        orderType: ad.orderType,
        price: adPriceUsd,
        quantity,
        feePerc,
        details: encryptedDetails
      }

      // @ts-ignore
      const createdOrUpdate = await createUpdate<OrderType>({
        model: OrderModel,
        data: {
          ...neworder,
        },
        ...neworder, // id and owner if it exists
      });

      await updateWallet({
        owner,
        amount: -walletAmountToRemove,
        source: OrderType.name,
        sourceId: createdOrUpdate.id,
        currency: walletCurrency,
      });

      await orderNotification(createdOrUpdate, "New order has been created");

      return { data: createdOrUpdate, success: true };

    } catch (error) {
      log('error checking out order', error);
      return { message: error.message || "", success: false };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async cancelOrder(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) orderId: string,
    @Arg('reason', () => String, { nullable: true, defaultValue: "" }) reason?: string,
  ): Promise<ResType> {
    const owner = _get(ctx, 'payload.userId', '');
    /**
     if is owner is creator
     if order is not accepted
     */

    try {
      const currentOrder = await OrderModel.findById(orderId);

      if (owner !== currentOrder.owner) {
        throw new Error("You are not the owner of this order")
      }

      if (currentOrder.status !== OrderStatus.requested) {
        throw new Error("You cannot cancel this order")
      }

      const updateOrder = await refundOrder({
        ...currentOrder,
        reason,
      });

      await orderNotification(currentOrder, "Order has been cancelled");

      return { success: true, data: updateOrder };

    } catch (error) {
      log('error cancelling order', error);
      return { success: false, message: error.message };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async confirmOrder(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) orderId: string,
    @Arg('confirm', () => Boolean, { nullable: true, defaultValue: true }) confirm?: boolean,
    @Arg('reason', () => String, { nullable: true, defaultValue: "" }) reason?: string,
  ): Promise<ResType> {
    const owner = _get(ctx, 'payload.userId', '');
    /**
      * 1. confirm true
      *   - add order balance to escrow
      *   - update order
      *   - notify owner of order
      
      * 2. confirm false
      *    - add order balance to owner account
      *    - notify owner of order
     **/

    try {
      const currentOrder = await OrderModel.findById(orderId);
      const isSeller = currentOrder.seller === owner;
      if (!isSeller) {
        throw new Error("Cannot confirm order");
      } else {
        if (confirm) {
          currentOrder.status = OrderStatus.accepted;
        } else {
          currentOrder.status = OrderStatus.cancelled;
          currentOrder.reason = reason;
        }
      }

      // TODO partail update
      const updateOrder = await OrderModel.updateById(orderId, {
        ...currentOrder,
      });

      return { success: true, data: updateOrder };

    } catch (error) {
      log('error confirming order', error);
      return { success: false, message: error.message };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async verifyOrder(
    @Ctx() ctx: ContextType,
    @Arg('orderId', () => String, { nullable: false }) orderId: string,
    @Arg('orderCode', () => String, { nullable: false }) orderCode: string
  ): Promise<ResType> {
    /**
     * 
      1. verify order code
        - update seller balance
        - update order status
     */

    try {
      const owner = _get(ctx, 'payload.userId', '');
      const verifiedOrder = await finalizeOrder(orderId, owner, orderCode)

      if (!verifiedOrder) {
        throw new Error("Order cannot be verified")
      }
      return { success: true, data: verifiedOrder };

    } catch (error) {
      log('error verifying order', error);
      return { success: false, message: error.message };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async finalizeOrder(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) orderId: string
  ): Promise<ResType> {
    try {
      const owner = _get(ctx, 'payload.userId', '');
      const verifiedOrder = await finalizeOrder(orderId, owner)

      if (!verifiedOrder) {
        throw new Error("Order cannot be verified")
      }
      return { success: true, data: verifiedOrder };

    } catch (error) {
      log('error verifying order', error);
      return { success: false, message: error.message };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async updateOrderTracking(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) orderId: string,
    @Arg('tracking', () => String, { nullable: false }) tracking: string
  ): Promise<ResType> {
    try {
      const owner = _get(ctx, 'payload.userId', '');
      const [err, order] = await awaitTo(OrderModel.findById(orderId));
      if (!order) {
        throw err;
      };
      // is seller
      const isSeller = order.seller === owner;
      if (!isSeller) {
        throw new Error("Only seller can update tracking")
      }

      if (order.status !== OrderStatus.accepted) {
        throw new Error("Cannot update order tracking")
      }

      const updatedOrder = await OrderModel.updateById(orderId, {
        ...order,
        tracking
      })

      if (!updatedOrder) {
        throw new Error("Order tracking was not updated")
      }

      return { success: true, data: updatedOrder };

    } catch (error) {
      log('error updating order tracking', error);
      return { success: false, message: error.message };
    }
  }


}

export default OrderResolver;
