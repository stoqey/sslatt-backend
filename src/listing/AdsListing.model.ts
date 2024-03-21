import { CommonType, Field, GeoType, InputType, Model, ObjectType, getPagination } from "couchset";
import { UserType, isAuth } from "@roadmanjs/auth";

import { UserStats } from "../user/userstats.model";
import { VendorType } from "../vendor/vendor.model";

export const AdsListingModelName = "AdListing";

@InputType("AdPricesInput")
@ObjectType()
class AdPrices {
  @Field(() => String, { nullable: true, description: "escrow | xxxxxxx | xxxxx " })
  type?: string = "";

  @Field(() => String, { nullable: true })
  price?: string = "";
}
/**
 * GraphQL Types start
 */
@InputType("AdsListingTypeInput")
@ObjectType()
export class AdsListingType {
  // Automatic
  // Automatic
  // Automatic
  @Field(() => String, { nullable: true })
  id?: string = "";

  @Field(() => String, { nullable: true })
  env?: string = "";

  @Field(() => String, { nullable: true })
  owner?: string | UserType = "";

  @Field(() => Date, { nullable: true })
  createdAt?: Date = new Date();

  @Field(() => Date, { nullable: true })
  updatedAt?: Date = new Date();

  @Field(() => Boolean, { nullable: true })
  deleted?: boolean = false;
  // Automatic
  // Automatic
  // Automatic

  @Field({ nullable: true })
  refUrl?: string = "";

  @Field({ nullable: true })
  adId?: string = "";

  @Field({ nullable: true })
  name?: string = "";

  @Field({ nullable: true })
  category?: string = "";

  @Field({ nullable: true })
  subcategory?: string = "";

  @Field({ nullable: true })
  title?: string = "";

  @Field({ nullable: true })
  description?: string = "";

  @Field({ nullable: true })
  info?: string = "";

  @Field({ nullable: true })
  phone?: string = "";

  @Field(() => String, { nullable: true })
  email?: string = "";

  @Field({ nullable: true })
  age?: number = 0;

  @Field({ nullable: true })
  ethnicity?: string = "";

  @Field({ nullable: true })
  availability?: string = "";

  @Field({ nullable: true })
  height?: string = "";

  @Field({ nullable: true })
  weight?: string = "";

  @Field({ nullable: true })
  hair?: string = "";

  @Field({ nullable: true })
  paid?: boolean = false;

  @Field({ nullable: true })
  visible?: boolean = true;

  @Field({ nullable: true })
  status?: string = "";

  @Field({ nullable: true })
  eye?: string = "";

  @Field({ nullable: true })
  price?: number = 0

  @Field((type) => [AdPrices], { nullable: true })
  prices?: AdPrices[] = [];

  @Field(() => [String], { nullable: true })
  photos?: string[] = [];

  @Field((type) => GeoType, { nullable: true })
  geo?: GeoType = { lat: 0, lon: 0 };

  @Field({ nullable: true })
  address?: string = "";

  @Field({ nullable: true })
  city?: string = "";

  @Field({ nullable: true })
  state?: string = "";

  @Field({ nullable: true })
  country?: string = "";

  @Field({ nullable: true })
  shipsFrom?: string = "";

  @Field({ nullable: true })
  shipsTo?: string = "";

  @Field({ nullable: true })
  zipCode?: string = "";

  @Field({ nullable: true })
  ratings?: number = 0;

  @Field({ nullable: true })
  ratingsCount?: number = 0;

  @Field({ nullable: true })
  reviewsCount?: number = 0;

  @Field({ nullable: true })
  salesCount?: number = 0;

  @Field({ nullable: true })
  viewsCount?: number = 0;

  @Field({ nullable: true })
  orderType?: string = "";
}

@ObjectType()
export class AdsListingOutput extends AdsListingType {
  @Field(() => UserType, { nullable: true })
  owner?: UserType;
};

@InputType("UserVendorAdsListingInput")
@ObjectType()
export class UserVendorAdsListing {
  @Field(() => UserType, { nullable: true })
  user?: UserType;

  @Field(() => UserStats, { nullable: true })
  userstats?: UserStats;

  @Field(() => VendorType, { nullable: true })
  store?: VendorType;

  @Field(() => [AdsListingType], { nullable: true })
  ads?: AdsListingType[];

}


export const AdsListingOutputgPagination = getPagination(AdsListingOutput);
export const AdsListingPagination = getPagination(AdsListingType);

export const adListingSelectors = [
  "id",
  "env",
  "owner",
  "createdAt",
  "updatedAt",
  "deleted",
  "refUrl",
  "adId",
  "name",
  "category",
  "subcategory",
  "title",
  "description",
  "info",
  "phone",
  "email",
  "age",
  "ethnicity",
  "availability",
  "height",
  "weight",
  "hair",
  "paid",
  "visible",
  "status",
  "eye",
  "price",
  "prices",
  "photos",
  "geo",
  "address",
  "city",
  "state",
  "country",
  "shipsFrom",
  "shipsTo",
  "zipCode",
  "ratings",
  "ratingsCount",
  "reviewsCount",
  "salesCount",
  "viewsCount",
  "orderType"
];

export const AdsListingModel: Model = new Model(AdsListingModelName, {
  graphqlType: AdsListingType,
});

const { pagination, resolver, modelKeys } = AdsListingModel.automate({
  authMiddleware: isAuth
});

export default AdsListingModel;

export { resolver as AdsListingResolver };

