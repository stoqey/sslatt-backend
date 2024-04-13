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
import AdsListingModel, { AdsListingModelName, AdsListingType, AdsListingPagination, adListingSelectors, AdsListingOutput } from "./AdsListing.model";
import { log } from "@roadmanjs/logs";
import { UserModel, UserType, isAuth } from "@roadmanjs/auth";
import { upsertCategoryStats } from "./AdsCategory.methods";
import { isEmpty } from "lodash";
import { OrderModel } from "../order";
import { connectionOptions } from "@roadmanjs/couchset";
import { upsertViews } from "./AdsListing.methods";
import { upsertSiteStats } from "../settings/settings.methods";


@Resolver()
export class AdsListingResolver {

  // TODO loginNotRequired
  // @UseMiddleware(isAuth)
  @Query(() => AdsListingOutput, { nullable: true })
  async getAdListing(
    @Ctx() ctx: ContextType,
    @Arg("id", { nullable: false }) id: string
  ): Promise<AdsListingOutput | null> {
    try {
      // TODO loginNotRequired
      const owner = _get(ctx, 'payload.userId', '');
      const bucket = connectionOptions.bucketName;

      const query = `
        SELECT *
        FROM \`${bucket}\` AS ad 
        LEFT JOIN \`${bucket}\` owner ON KEYS ad.owner
        WHERE ad._type = "${AdsListingModelName}"
        AND ad.id = "${id}";
      `;

      const [errorFetching, data = []] = await awaitTo(
        AdsListingModel.customQuery<{ ad: AdsListingType, owner: UserType }>({
          limit: 1,
          query,
          params: { id },
        })
      );

      if (errorFetching) {
        throw errorFetching;
      }

      const [rows = []] = data;

      if (isEmpty(rows)) {
        throw new Error("rows not found");
      }

      const adOwner = rows.shift();

      const isAdVisible = _get(adOwner, 'ad.visible', false);
      const isOwner = _get(adOwner, 'ad.owner', '') === owner;

      if (!isAdVisible && !isOwner) {
        throw new Error("Ad not visible");
      }

      if (adOwner && adOwner.ad && !isOwner) { // only update views if not owner
        // TODO use queue
        await upsertViews(adOwner.ad)
      }


      return {
        ...(adOwner && adOwner.ad ? AdsListingModel.parse(adOwner?.ad) : {}),
        owner: adOwner && adOwner.owner ? UserModel.parse(adOwner?.owner) : null as any
      }

    } catch (error) {
      log("error getting Ad listing", error);
      return null;
    }
  }

  @Query(() => AdsListingPagination)
  @UseMiddleware(isAuth)
  async myAds(
    @Ctx() ctx: ContextType,
    @Arg('filter', () => String, { nullable: true }) filter?: string,
    @Arg('sort', () => String, { nullable: true }) sortArg?: string,
    @Arg('before', () => Date, { nullable: true }) before?: Date,
    @Arg('after', () => Date, { nullable: true }) after?: Date,
    @Arg('limit', () => Number, { nullable: true }) limitArg?: number
  ): Promise<{ items: AdsListingType[]; hasNext?: boolean; params?: any }> {
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
                  FROM \`${bucket}\` ad
                  WHERE ad._type = "${AdsListingModelName}"
                  AND ad.owner = "${owner}"
                  AND ad.createdAt ${sign} "${time.toISOString()}"
                  ORDER BY ad.createdAt ${sort}
                  LIMIT ${limitPassed};
              `;

      const [errorFetching, data = []] = await awaitTo(
        AdsListingModel.customQuery<any>({
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
        const { ad } = d;
        return AdsListingModel.parse(ad);
      });

      return { items: dataToSend, params: copyParams, hasNext };
    } catch (error) {
      log('error getting ads', error);
      return { items: [], hasNext: false, params: copyParams };
    }
  }

  @Query(() => [AdsListingType])
  @UseMiddleware(isAuth)
  async myAdListing(
    @Ctx() ctx: ContextType,
    @Arg("filter", { nullable: true }) filter?: string,
    @Arg("owner", { nullable: true }) ownerArg?: string,
    @Arg("page", { nullable: true }) page?: number,
    @Arg("limit", { nullable: true }) limit?: number
  ): Promise<AdsListingType[]> {
    const owner = _get(ctx, 'payload.userId', '');
    try {
      const wherers: any = {
        owner: { $eq: owner },
      };

      const data = await AdsListingModel.pagination({
        select: adListingSelectors,
        where: wherers,
        limit,
        page,
      });

      return data;
    } catch (error) {
      log("error getting ads listing methods", error);
      return [];
    }
  }

  @Mutation(() => ResType, { nullable: true })
  @UseMiddleware(isAuth)
  async deleteAdListing(
    @Ctx() ctx: ContextType,
    @Arg("id", { nullable: false }) adId: string,
  ): Promise<ResType> {

    const owner = _get(ctx, 'payload.userId', '');

    try {
      // if we have orders not to delete
      // TODO only active, change deleted=true
      const [_errorOrders, existingOrders] = await awaitTo(OrderModel.pagination({
        where: {
          typeId: adId
        },
        limit: 1
      }));

      if (!isEmpty(existingOrders)) {
        throw new Error("Cannot delete ad, orders attached to it");
      }

      const [_errorExistingAd, existingAd] = await awaitTo(AdsListingModel.findById(adId));
      if (!existingAd) {
        throw new Error("Ad listing not found");
      }

      if (existingAd.owner !== owner) {
        throw new Error("Ad cannot be deleted");
      }

      const deleted = await AdsListingModel.delete(adId);
      if (!deleted) {
        throw new Error("Ad listing not deleted");
      }

      return {
        success: true,
      };

    } catch (error) {
      log("error deleting Ad listing", error);
      return { success: false, message: error && error.message };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async changeVisibilityAdListing(
    @Arg("id", { nullable: false }) id: string,
    @Arg("visible", { nullable: false }) visible: boolean,
    @Arg("owner", { nullable: false }) owner: string
  ): Promise<ResType> {
    try {
      const [err, adToEdit] = await awaitTo(AdsListingModel.findById(id))
      if (err) {
        throw new Error("Ad listing not found");
      };

      const [errEdit, edited] = await awaitTo(AdsListingModel.updateById(id, {
        ...adToEdit,
        visible
      }));

      if (errEdit) {
        throw new Error("Ad listing not edited");
      }

      return {
        success: true,
        data: edited
      };
    } catch (error) {
      log("error deleting Ad listing", error);
      return { success: false, message: error && error.message };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async createAdListing(@Ctx() ctx: ContextType, @Arg("args") args: AdsListingType): Promise<ResType> {
    try {
      const owner = _get(ctx, 'payload.userId', '');
      const isNew = !args.id || args.id === "new";

      const updateAd = isNew ? {
        ...args,
        owner,
        id: undefined,
      } : args;

      // If updating
      // TODO check if create is owner

      // @ts-ignore
      const createdOrUpdate = await createUpdate({
        model: AdsListingModel,
        data: {
          ...updateAd,
        },
        ...updateAd, // id and owner if it exists
      });

      if (createdOrUpdate) {
        // todo queue
        await upsertCategoryStats(args.subcategory as any);

        // todo queue
        if (isNew) {
          await upsertSiteStats({ ad: true });
        };

        return { success: true, data: AdsListingModel.parse(createdOrUpdate) };
      }

      throw new Error("error creating ad listing method ");
    } catch (err) {
      console.error(err && err.message, err);
      return { success: false, message: err && err.message };
    }
  }
}

export default AdsListingResolver;
