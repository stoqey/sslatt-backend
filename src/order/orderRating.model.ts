import { CommonType, Field, GeoType, InputType, Model, ObjectType, getPagination } from "couchset";
import { UserType, isAuth } from "@roadmanjs/auth";

import { AdsListingType } from "../listing/AdsListing.model";
import { OrderType } from "./order.model";

export const OrderRatingModelName = "OrderRating";

/**
 * GraphQL Types start
 */
@InputType(`${OrderRatingModelName}Input`)
@ObjectType()
export class OrderRatingType {
  // Automatic
  @Field(() => String, { nullable: true })
  id?: string = "";

  @Field(() => String, { nullable: true })
  typeId?: string = "";

  @Field(() => String, { nullable: true })
  orderId?: string = "";

  @Field(() => String, { nullable: true })
  owner?: string | UserType = "";

  @Field(() => String, { nullable: true })
  buyer?: string | UserType = "";

  @Field(() => String, { nullable: true })
  seller?: string | UserType = "";

  @Field(() => Date, { nullable: true })
  createdAt?: Date = new Date();

  @Field(() => Date, { nullable: true })
  updatedAt?: Date = new Date();

  @Field(() => Boolean, { nullable: true })
  deleted?: boolean = false;
  // Automatic
  // Automatic

  @Field({ nullable: true })
  review?: string = "";

  @Field({ nullable: true })
  rating?: number = 0;
}


@ObjectType()
export class OrderRatingOutput extends OrderRatingType {
  @Field(() => AdsListingType, { nullable: true })
  ad?: AdsListingType;

  @Field(() => OrderType, { nullable: true })
  order?: OrderType;

  @Field(() => UserType, { nullable: true })
  owner?: UserType;

  @Field(() => UserType, { nullable: true })
  buyer?: UserType;

  @Field(() => UserType, { nullable: true })
  seller?: UserType;
}



export const OrderRatingOutputPagination = getPagination(OrderRatingOutput);
export const OrderRatingPagination = getPagination(OrderRatingType);

export const orderRatingSelectors = [
  "id",
  "typeId",
  "orderId",
  "owner",
  "seller",
  "buyer",
  "createdAt",
  "updatedAt",
  "review",
  "rating",
];

export const OrderRatingModel: Model = new Model(OrderRatingModelName, {
  graphqlType: OrderRatingType,
});

const { pagination, resolver, modelKeys } = OrderRatingModel.automate({
  authMiddleware: isAuth
});

export default OrderRatingModel;

export { resolver as OrderRatingDefaultResolver };

