import { CommonType, Field, GeoType, InputType, Model, ObjectType, getPagination } from "couchset";

import { isAuth } from "@roadmanjs/auth";

export const AdCategoryModelName = "AdCategory";

/**
 * GraphQL Types start
 */
@InputType("AdCategoryInput")
@ObjectType()
export class AdCategoryType implements CommonType {
  // Automatic
  // Automatic
  // Automatic
  @Field(() => String, { nullable: true })
  id?: string = "";

  @Field(() => Date, { nullable: true })
  createdAt?: Date = new Date();

  @Field(() => Date, { nullable: true })
  updatedAt?: Date = new Date();

  @Field(() => Boolean, { nullable: true })
  deleted?: boolean = false;
  // Automatic
  // Automatic
  // Automatic

  @Field(() => Number, { nullable: true, description: "Number of products, listings" })
  count?: number = 0;

  @Field(() => String, { nullable: true, description: "Parent category if any" })
  category?: string = "";

  @Field(() => String, { nullable: true })
  name?: string = "";
}

export const AdCategoryPagination = getPagination(AdCategoryType);

export const adCategorySelectors = [
  "id",
  "createdAt",
  "updatedAt",
  "deleted",
  "name",
  "category",
  "count"
];

export const AdCategoryModel: Model = new Model(AdCategoryModelName, {
  graphqlType: AdCategoryType,
});

const { pagination, resolver, modelKeys } = AdCategoryModel.automate({
  authMiddleware: isAuth
});

export default AdCategoryModel;

export { resolver as AdCategoryResolver };

