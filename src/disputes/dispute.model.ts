import { Field, InputType, Model, ObjectType, getPagination } from "couchset";
import { UserType, isAuth } from "@roadmanjs/auth";

import { OrderType } from "../order";

/**
 * GraphQL Types start
 */
@InputType("DisputeInput")
@ObjectType()
export class Dispute {
  // Automatic
  @Field(() => String, { nullable: true })
  id?: string = "";

  @Field(() => String, { nullable: true })
  owner?: string | UserType = "";

  @Field(() => String, { nullable: true })
  seller?: string | UserType = "";

  @Field(() => Date, { nullable: true })
  createdAt?: Date = new Date();

  @Field(() => Date, { nullable: true })
  updatedAt?: Date = new Date();

  @Field(() => Boolean, { nullable: true })
  deleted?: boolean = false;
  // Automatic

  @Field({ nullable: true })
  status?: string = "";

  // if status === cancelled
  @Field({ nullable: true })
  reason?: string = "";

  @Field({ nullable: true })
  order?: OrderType | string = "";

}

@ObjectType()
export class DisputeOutput extends Dispute {

  @Field({ nullable: true, description: "Owner" })
  owner?: UserType; // no auto

  @Field({ nullable: true, description: "Seller" })
  seller?: UserType; // no auto

  @Field({ nullable: true, description: "Order" })
  order?: OrderType; // no auto

}

export const DisputePagination = getPagination(Dispute);
export const DisputeOutputPagination = getPagination(DisputeOutput);

export const disputeSelectors = [
  "id",
  "owner",
  "seller",
  "createdAt",
  "updatedAt",
  "type",
  "status",
  "reason",
  "orderId",
];

export const DisputeModel: Model = new Model(Dispute.name, {
  graphqlType: Dispute,
});

const { pagination, resolver, modelKeys } = DisputeModel.automate({
  authMiddleware: isAuth
});

export default DisputeModel;

export { resolver as DisputeDefaultResolver };

