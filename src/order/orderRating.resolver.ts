import {
  Resolver,
  Query,
  Mutation,
  Arg,
  UseMiddleware,
  Ctx,
  // Int,
} from "type-graphql";
import {
  ContextType,
  CouchbaseConnection,
  createUpdate,
  ResType,
} from "couchset";
import querystring from "querystring";
import _get from "lodash/get";
import OrderModel, { } from "./order.model";
import { log } from "@roadmanjs/logs";
import { UserModel, isAuth } from "@roadmanjs/auth";
import { identity, isEmpty, omit, pickBy } from "lodash";
import OrderRatingModel, { OrderRatingType, orderRatingSelectors, OrderRatingPagination, OrderRatingOutputPagination, OrderRatingOutput, OrderRatingModelName } from "./orderRating.model";
import { connectionOptions } from "@roadmanjs/couchset";
import { awaitTo } from "couchset/dist/utils";
import AdsListingModel, { AdsListingModelName } from "../listing/AdsListing.model";
import { getVendorStore } from "../vendor/vendor.methods";
import { upsertRatingsReviews } from "./orderRating.methods";
import { VendorModel } from "../vendor/vendor.model";


@Resolver()
export class OrderRatingResolver {


  @Mutation(() => ResType, { nullable: true })
  @UseMiddleware(isAuth)
  async rateOrder(
    @Ctx() ctx: ContextType,
    @Arg('id', () => String, { nullable: false }) orderId: string,
    @Arg('rating', () => Number, { nullable: true, defaultValue: 0 }) rating: number,
    @Arg('review', () => String, { nullable: true, defaultValue: "" }) review: string
  ): Promise<ResType> {
    const owner = _get(ctx, 'payload.userId', '');
    // TODO Reviews model
    /**
     * 1. check if order rating exists -> update order rating
     * 2. create a new order rating
     */

    try {

      let order = await OrderModel.findById(orderId);

      if (isEmpty(order)) {
        throw new Error("Order not found")
      };

      const updateRatings = async () => {

        const store = await getVendorStore(order.seller);
        if (isEmpty(store)) {
          log("store not found", order.seller);
        } else {
          const updatedStoreRatings = await upsertRatingsReviews({
            filters: { seller: order.seller },
            table: {
              model: VendorModel,
              item: store
            }
          });


          // log("updatedStoreRatings", updatedStoreRatings);

          if (!updatedStoreRatings) {
            log("failed updatedStoreRatings")
          }

        }

        const [errorAd, ad] = await awaitTo(AdsListingModel.findById(order.typeId));
        if (isEmpty(ad)) {
          log("ad not found typeId" + order.typeId, errorAd);
        } else {
          const updatedAdRatings = await upsertRatingsReviews({
            filters: { typeId: order.typeId },
            table: {
              model: AdsListingModel,
              item: ad
            }
          });

          // log("updatedStoreRatings", updatedAdRatings);
          
          if (!updatedAdRatings) {
            log("failed updatedAdRatings")
          }
        }
      }

      const isOwner = order.owner === owner;
      const isSeller = order.seller === owner;
      if (isSeller) {
        throw new Error("Seller cannot rate order");
      }

      let existingReview: OrderRatingType = (await OrderRatingModel.pagination({
        select: orderRatingSelectors,
        where: {
          owner, orderId,
        }
      }))[0];

      if (!existingReview) {

        const newOrderRating: OrderRatingType = {
          owner,
          orderId,
          rating,
          review,
          typeId: order.typeId,
          buyer: order.owner,
          seller: order.seller,
        }

        const orderRating = await createUpdate<OrderRatingType>({
          model: OrderRatingModel,
          data: {
            ...newOrderRating,
          },
          ...newOrderRating as any, // id and owner if it exists
        });

        // update order with rating
        order = await OrderModel.updateById(orderId, {
          ...order,
          // TODO sellerRating is deprecated
          [isOwner ? "ownerRating" : "sellerRating"]: orderRating.id,
        });

        // TODO update ratings ad{typeId: order.typeId}, seller{seller: order.seller}
        // TODO use queue
        await updateRatings();

        return { data: orderRating, success: true };
      }

      existingReview.rating = rating;
      existingReview.review = review;
      existingReview = await OrderRatingModel.updateById(existingReview.id as any, existingReview);

      // TODO update ratings ad{typeId: order.typeId}, seller{seller: order.seller}
      // TODO use queue
      await updateRatings();
      return { data: existingReview, success: true };

    } catch (error) {
      log('error rating order', error);
      return { success: false, message: error.message };
    }
  }

  @Query(() => OrderRatingType, { nullable: true })
  @UseMiddleware(isAuth)
  async getOrderRating(
    @Ctx() ctx: ContextType,
    @Arg('orderId', () => String, { nullable: false }) orderId: string
  ): Promise<OrderRatingType | null> {
    const owner = _get(ctx, 'payload.userId', '');

    try {

      let existingReview: OrderRatingType = (await OrderRatingModel.pagination({
        select: orderRatingSelectors,
        where: {
          owner, orderId,
        }
      }))[0];

      return existingReview;

    } catch (error) {
      log('error rating order', error);
      return null;
    }
  }

  @Query(() => OrderRatingOutputPagination)
  async getOrderRatings(
    @Ctx() ctx: any,
    @Arg("filters", { nullable: true, description: "All search filters field=val&field2=val2" }) filters?: string,
    @Arg('sort', () => String, { nullable: true }) sortArg?: string,
    @Arg("after", { nullable: true }) after?: Date,
    @Arg("before", { nullable: true }) before?: Date,
    // @Arg("page", { nullable: true }) page?: number,
    @Arg("limit", { nullable: true }) limitArg: number = 10
  ): Promise<{ items: OrderRatingOutput[]; hasNext: boolean; params: any }> {

    const owner = _get(ctx, 'payload.userId', '');
    const bucket = CouchbaseConnection.Instance.bucketName;
    const sign = before ? '<=' : '>=';
    const time = new Date(before || after || new Date());
    const sort = sortArg || 'DESC';
    const limit = limitArg || 100;
    const limitPassed = limit + 1; // adding +1 for hasNext

    let filtersKeyVal: any = [];
    if (!isEmpty(filters)) {
      const filtersQuery = querystring.parse(filters || "");
      filtersKeyVal = Object.keys(filtersQuery).map((key) => {
        return { key, value: filtersQuery[key] }
      }
      );
    };

    console.log("filtersKeyVal", filtersKeyVal);

    const copyParams = pickBy(
      {
        filters,
        sort,
        before,
        after,
        limit,
      },
      identity
    );

    try {

      const bucket = connectionOptions.bucketName;

      if (isEmpty(filtersKeyVal)) {
        throw new Error("filters required");
      };
      // LEFT JOIN \`${bucket}\` order ON KEYS dev.orderId

      const query = `
          SELECT *
          FROM \`${bucket}\` AS dev
          LEFT JOIN \`${bucket}\` owner ON KEYS dev.owner
          LEFT JOIN \`${bucket}\` buyer ON KEYS dev.buyer
          LEFT JOIN \`${bucket}\` seller ON KEYS dev.seller
          LEFT JOIN \`${bucket}\` ad ON KEYS dev.typeId
          LEFT JOIN \`${bucket}\` \`order\` ON KEYS dev.orderId
          WHERE dev._type = "${OrderRatingModelName}" 
          ${isEmpty(filtersKeyVal) ? "" : `${filtersKeyVal.map((filter: any) => `AND dev.${filter.key}="${filter.value}"`).join(" ")}`}
          ORDER BY dev.createdAt ${sort}
          LIMIT ${limitPassed};
      `;

      const [errorFetching, data = []] = await awaitTo(
        OrderRatingModel.customQuery<any>({
          limit,
          query,
          params: copyParams,
        })
      );

      if (errorFetching) {
        throw errorFetching;
      }

      const [rows = []] =
        data;

      const hasNext = rows.length > limit;

      if (hasNext) {
        rows.pop(); // remove last element
      }

      const parsedItems = rows
        // .filter((row) => {
        //   // TODO is tor env
        //   if (ignoreMissingEnv && isEmpty(row.env)) {
        //     return true;
        //   }
        //   return row.env === env;
        // })
        .map((d) => {
          const ad = AdsListingModel.parse(d.ad);
          const order = !d.order ? null : OrderModel.parse(d.order);
          const owner = !d.owner ? null : UserModel.parse(d.owner);
          const buyer = !d.buyer ? null : UserModel.parse(d.buyer);
          const seller = !d.seller ? null : UserModel.parse(d.seller);

          const rating = OrderRatingModel.parse(omit(d.dev, ["owner", "buyer", "seller", "ad", "order"]))
          return { ...rating, ad, owner, buyer, seller, order };
        });


      log("items", { parsedItems: parsedItems.length, rows: rows.length });

      return { items: parsedItems, params: copyParams, hasNext };

    } catch (error) {
      log("error getting order ratings", error);
      return { items: [], hasNext: false, params: copyParams };
    }
  }


}

export default OrderRatingResolver;
