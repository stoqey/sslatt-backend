import {
  Resolver,
  Query,
  Arg,
  Ctx,
  ObjectType,
  Field
} from "type-graphql";
import querystring from "querystring";
import { awaitTo } from "@stoqey/client-graphql";
import { CouchbaseConnection, getPagination } from "couchset";
import _get from "lodash/get";
import _, { compact, flatten, has, identity, isEmpty, pickBy } from "lodash";
import AdsListingModel, {
  AdsListingType,
  adListingSelectors,
  AdsListingModelName,
  AdsListingPagination,
  UserVendorAdsListing,
  AdsListingOutputgPagination,
  AdsListingOutput
} from "./AdsListing.model";
import {
  getDistanceFromZoom,
  getSearchLimitFromZoom,
  upsertViews,
} from "./AdsListing.methods";
import { log } from "@roadmanjs/logs";
import { connectionOptions } from "@roadmanjs/couchset";
import { VendorModel, VendorType, VendorTypeModelName } from "../vendor/vendor.model";
import { UserModel, UserType } from "@roadmanjs/auth";
import AdCategoryModel from "./AdCategory.model";
import { UserStats, UserStatsModel, UserStatsModelName } from "../user/userstats.model";

@ObjectType()
class UserVendorAdsListingPage {

  @Field(() => UserVendorAdsListing, { nullable: true })
  item?: UserVendorAdsListing;

  @Field(() => Boolean, { nullable: true })
  hasNext: boolean;
}

@Resolver()
export class AdsListingPublicResolver {

  @Query(() => UserVendorAdsListingPage, { nullable: true })
  async getUserVendorAdsListing(
    @Arg("username", { nullable: true }) username: string,
    // TODO pagination before and after
    @Arg("after", { nullable: true }) after: Date,
    @Arg("before", { nullable: true }) before: Date,
    @Arg("limit", { nullable: true }) limit: number = 10
  ): Promise<UserVendorAdsListingPage | null> {
    const copyParams = pickBy(
      {
        username,
        before,
        after,
        limit,
      },
      identity
    );

    try {
      const bucket = connectionOptions.bucketName;

      const sign = before ? "<=" : ">=";
      const time = new Date(before || after);


      /**
       SELECT * FROM \`${bucket}\` ad
        WHERE ad._type = "${AdsListingModelName}"
        AND ad.owner = "${owner}"
        AND ad.visible = true
        AND ad.createdAt ${sign} "${time.toISOString()}"
        ORDER BY ad.createdAt DESC
        LIMIT ${limit};
       */
      const query = `
        SELECT *
        FROM \`${bucket}\` AS u 
        LEFT JOIN \`${bucket}\` AS ads on ads.owner = u.id AND ads._type = "${AdsListingModelName}" AND ads.visible = TRUE
        LEFT JOIN \`${bucket}\` AS store on store.owner = u.id AND store._type = "${VendorTypeModelName}"
        LEFT JOIN \`${bucket}\` AS userstats on userstats.owner = u.id AND userstats._type = "${UserStatsModelName}"
        WHERE u._type = "User"
            AND u.username = "${username}"
        LIMIT ${limit};
      `;

      const [errorFetching, data = []] = await awaitTo(
        AdsListingModel.customQuery<any>({
          limit,
          query,
          params: copyParams,
        })
      );

      if (errorFetching) {
        throw errorFetching;
      }

      // TODO has next

      const [rows = [], options = { hasNext: false, params: copyParams }] =
        data;

      const allAds = compact(flatten(rows.map((d) => {
        return d.ads? AdsListingModel.parse(d.ads): null;
      })));

      let store, user, userstats;
      const firstItem = rows.shift();
      if (firstItem) {
        userstats = !firstItem.userstats ? null : UserStatsModel.parse(firstItem.userstats);
        store = !firstItem.store ? null : VendorModel.parse(firstItem.store);
        user = !firstItem.u ? null : UserModel.parse(firstItem.u);
      }

      return { item: { ads: allAds, store, user, userstats }, hasNext: options.hasNext };

    } catch (error) {
      log("error getting Ad listing", error);
      return null;
    }
  }

  /**
   * 
   * @param ctx 
   * @param filters 
   * @param search 
   * @param sortArg 
   * @param env 
   * @param after 
   * @param before 
   * @param limitArg 
       AND env="${env}"
       AND env IS NOT NULL
       AND env IS NOT MISSING
       using lat, log like onMapRegion
       filters ${allFilters.map((filter: any) => `AND ${filter.key}="${filter.value}"`).join(" ")}

        AND ad.createdAt ${sign} "${time.toISOString()}"
        AND SEARCH(${bucket}, { "query": { "match": "${searchString}", "field": "description", "analyzer": "standard" } })
        OR SEARCH(${bucket}, { "query": { "match": "${searchString}", "field": "category", "analyzer": "standard" } })
        OR SEARCH(${bucket}, { "query": { "match": "${searchString}", "field": "title", "analyzer": "standard" } })
        OR SEARCH(${bucket}, { "query": { "match": "${searchString}", "field": "city", "analyzer": "standard" } })
        OR SEARCH(${bucket}, { "query": { "match": "${searchString}", "field": "name", "analyzer": "standard" } })

   * @returns 
   */
  @Query(() => AdsListingOutputgPagination, { nullable: true })
  async searchAdListingPublic(
    @Ctx() ctx: any,
    @Arg("filters", { nullable: true, description: "All search filters field=val&field2=val2" }) filters?: string,
    @Arg("search", { nullable: true }) search?: string,
    @Arg('sort', () => String, { nullable: true }) sortArg?: string,
    @Arg("env", { nullable: true }) env: string = "fluencerz", // TODO
    @Arg("after", { nullable: true }) after?: Date,
    @Arg("before", { nullable: true, description: "Deprecated" }) before?: Date,
    // @Arg("page", { nullable: true }) page?: number,
    @Arg("limit", { nullable: true }) limitArg: number = 10
  ): Promise<{ items: AdsListingOutput[]; hasNext: boolean; params: any }> {

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
    console.log("search", search);

    const searchString = `${search}`.toLowerCase(); // TODO regex
    const searchQuery = isEmpty(searchString) ? "" :
      `
      AND SEARCH(${bucket}, { "query": { "match": "${searchString}", "field": "title", "analyzer": "standard" } })
      OR SEARCH(${bucket}, { "query": { "match": "${searchString}", "field": "category", "analyzer": "standard" } })
      OR SEARCH(${bucket}, { "query": { "match": "${searchString}", "field": "subcategory", "analyzer": "standard" } })
      OR SEARCH(${bucket}, { "query": { "match": "${searchString}", "field": "description", "analyzer": "standard" } })
    `;

    // TODO timesort, 
    const copyParams = pickBy(
      {
        search,
        filters,
        sort,
        env,
        before,
        after,
        limit,
      },
      identity
    );

    try {

      const bucket = connectionOptions.bucketName;
      // TODO JOIN ratings

      const query = `
          SELECT *
          FROM \`${bucket}\` AS dev
          LEFT JOIN \`${bucket}\` owner ON KEYS dev.owner
          WHERE dev._type = "${AdsListingModelName}" 
          ${isEmpty(filtersKeyVal) ? "" : `${filtersKeyVal.map((filter: any) => `AND dev.${filter.key}="${filter.value}"`).join(" ")}`}
          AND dev.visible=TRUE
          ${searchQuery}
          ORDER BY dev.createdAt ${sort}
          LIMIT ${limitPassed};
      `;

      const [errorFetching, data = []] = await awaitTo(
        AdsListingModel.customQuery<any>({
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

      // console.log("rows 1", rows[0]);


      const parsedItems = rows
        // .filter((row) => {
        //   // TODO is tor env
        //   if (ignoreMissingEnv && isEmpty(row.env)) {
        //     return true;
        //   }
        //   return row.env === env;
        // })
        .map((d) => {
          const { dev, owner } = d;
          if(dev._type !== AdsListingModelName) return null;
          const ad = AdsListingModel.parse(dev);
          const user = owner ? UserModel.parse(owner) : null;
          return { ...ad, owner: user };
        });


      log("items", { parsedItems: parsedItems.length, rows: rows.length });

      return { items: compact(parsedItems), params: copyParams, hasNext };

    } catch (error) {
      log("error getting ads listing methods", error);
      return { items: [], hasNext: false, params: copyParams };
    }
  }

  @Query(() => [AdsListingType])
  async onMapRegion(
    @Arg("lat", { nullable: false }) lat: number,
    @Arg("lon", { nullable: false }) lon: number,
    @Arg("env", { nullable: false }) env?: string,
    @Arg("zoom", { nullable: true }) zoom?: number
  ): Promise<AdsListingType[]> {
    const zoomNumber = zoom || 4;
    const limit = getSearchLimitFromZoom(zoomNumber);
    const units = "km";
    const zoomAmount = getDistanceFromZoom(zoomNumber);
    const copyParams = pickBy(
      {
        lat,
        env,
        lon,
        zoom,
        limit,
        units,
        zoomAmount,
      },
      identity
    );

    console.log("env", copyParams);

    try {
      const bucket = connectionOptions.bucketName;

      const query = `
        SELECT 
        d.*,
        (ACOS(SIN( RADIANS(${lat})) * SIN(RADIANS(d.geo.lat)) + COS( RADIANS(${lat})) * COS(RADIANS(d.geo.lat)) * COS(RADIANS(d.geo.lon) - RADIANS(${lon}))) * 6371) AS distance
        FROM \`${bucket}\` d
        WHERE d.geo.lat IS NOT NULL AND d.geo.lat IS NOT MISSING
        AND (ACOS(SIN( RADIANS(${lat})) * SIN(RADIANS(d.geo.lat)) + COS( RADIANS(${lat})) * COS(RADIANS(d.geo.lat)) * COS(RADIANS(d.geo.lon) - RADIANS(${lon}))) * 6371) <= ${zoomAmount}
        ORDER BY distance ASC
        LIMIT ${limit};
      `;

      const [errorFetching, data = []] = await awaitTo(
        AdsListingModel.customQuery<AdsListingType>({
          limit,
          query,
          params: copyParams,
        })
      );

      if (errorFetching) {
        throw errorFetching;
      }

      const [rows = [], options = { hasNext: false, params: copyParams }] =
        data;

      console.log("rows are", rows.length);

      const parsedItems = rows.map((row) => AdsListingModel.parse(row));
      return parsedItems;
    } catch (error) {
      log("error getting ads listing methods", error);
      return [];
    }
  }
}

export default AdsListingPublicResolver;
