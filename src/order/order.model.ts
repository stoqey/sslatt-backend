import { CommonType, Field, GeoType, InputType, Model, ObjectType, getPagination } from "couchset";
import { UserType, isAuth } from "@roadmanjs/auth";

import { AdsListingType } from "../listing/AdsListing.model";
import { OrderRatingType } from "./orderRating.model";

export const OrderModelName = "Order";

export const OrderStatus = {
  requested: "requested",
  accepted: "accepted",
  cancelled: "cancelled",
  completed: "completed",
}

export const OrderTypeTracking = {
  // TODO more
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered"
}


/**
 * GraphQL Types start
 */
@InputType("OrderTypeInput")
@ObjectType()
export class OrderType {
  // Automatic
  // Automatic
  // Automatic
  @Field(() => String, { nullable: true })
  id?: string = "";

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

  @Field(() => String, { nullable: true })
  seller?: string | UserType = "";

  @Field(() => String, { nullable: true })
  sellerRating?: string | OrderRatingType = "";

  @Field(() => String, { nullable: true })
  ownerRating?: string | OrderRatingType = "";

  @Field(() => String, { nullable: true })
  name?: string = "";

  // TODO order types, ad, e.t.c
  @Field(() => String, { nullable: true })
  type?: string = "";

  @Field(() => String, { nullable: true })
  typeId?: string = "";

  @Field(() => Boolean, { nullable: true })
  paid?: boolean = false;

  @Field(() => String, { nullable: true })
  escrow?: boolean = false;

  @Field(() => String, { nullable: true })
  tracking?: string = "";

  @Field(() => String, { nullable: true })
  orderType?: string = "";

  @Field(() => String, { nullable: true })
  details?: string = "";

  // TODO draft -> request (paid), accepted(link: verify), cancelled, completed/finalize
  // TODO                      -> + seller ----------------------------------> 
  // TODO ------------------------------------------------------------------->
  // TODO                      -> + buyer ----------------------------------->
  /**
                             Owner                  ------                Seller
    Status: Request           pending                                      confirm order
    Status: Accepted          show receipt                                 verify receipt (if link), finalize (ship)
    Status:   -> LINK                                                      verify -> finalize
    Status:   -> SHIP         verify -> finalize                           finalize
    Status:   -> DEFAULT      verify -> finalize                           finalize
   
    Status: Cancelled:U       refund                                       -------
              -> request      refund                                       -------
              -> accepted     refund -fee                                  +fee
    Status: Cancelled:S       refund                                       -------
              -> request      refund                                       -------
              -> accepted     refund                                       -------       
              -> rejected     refund                                       -------       
    Status: Completed         show receipt                                 verify receipt (if link), finalize (ship)
   */
  @Field(() => String, { nullable: true })
  status?: string = "";

  // if status === cancelled
  @Field(() => String, { nullable: true })
  reason?: string = "";

  @Field(() => String, { nullable: true })
  code?: string = "";

  @Field(() => Number, { nullable: true })
  price?: number = 0

  @Field(() => Number, { nullable: true })
  quantity?: number = 0

  @Field(() => Number, { nullable: true })
  feePerc?: number = 0

}

@ObjectType()
export class OrderTypeOutput extends OrderType {

  @Field((type) => UserType, { nullable: true, description: "Owner" })
  owner?: UserType;

  @Field((type) => UserType, { nullable: true, description: "Seller" })
  seller?: UserType;

  @Field((type) => AdsListingType, { nullable: true, description: "Product" })
  product?: AdsListingType;  // todo GraphQLScalar

  // @deprecated
  @Field((type) => OrderRatingType, { nullable: true, description: "Seller rating" })
  sellerRating?: OrderRatingType;

  @Field((type) => OrderRatingType, { nullable: true, description: "Owner rating" })
  ownerRating?: OrderRatingType;

}

export const OrderPagination = getPagination(OrderType);

export const OrderTypeOutputPagination = getPagination(OrderTypeOutput);

export const orderSelectors = [
  "id",
  "owner",
  "ownerRating",
  "createdAt",
  "updatedAt",
  "name",
  "type",
  "typeId",
  "seller",
  "sellerRating",
  "paid",
  "escrow",
  "tracking",
  "orderType",
  "details",
  "status",
  "reason",
  "code",
  "price",
  "quantity",
  "feePerc"
];

export const OrderModel: Model = new Model(OrderModelName, {
  graphqlType: OrderType,
});

const { pagination, resolver, modelKeys } = OrderModel.automate({
  authMiddleware: isAuth
});

export default OrderModel;

export { resolver as OrderDefaultResolver };

