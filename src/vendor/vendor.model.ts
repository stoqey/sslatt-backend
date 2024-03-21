import { Field, InputType, Model, ObjectType } from "couchset";

import { UserType } from "@roadmanjs/auth";

// use environment variables

@InputType("VendorTypeInput")
@ObjectType()
export class VendorType {

  @Field(() => String, { nullable: true })
  id?: string = "";

  @Field(() => String, { nullable: true })
  name?: string = "";

  @Field(() => String, { nullable: true })
  owner?: string | UserType = "";

  @Field(() => Date, { nullable: true })
  createdAt?: Date = new Date();

  @Field(() => Date, { nullable: true })
  updatedAt?: Date = new Date();

  @Field(() => Boolean, { nullable: true })
  deleted?: boolean = false;

  // Store info
  @Field(() => String, { nullable: true })
  cover?: string = "";

  @Field(() => String, { nullable: true })
  avatar?: string = "";

  @Field(() => String, { nullable: true })
  bio?: string = "";

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  vacation?: boolean = false;

  @Field({ nullable: true })
  country?: string = "";

  // TODO
  @Field(() => String, { nullable: true })
  shipsTo?: string = "";

  // TODO
  @Field(() => String, { nullable: true })
  shipsFrom?: string = "";

  // Counts

  @Field(() => Number, { nullable: true })
  ratings?: number = 0;

  @Field(() => Number, { nullable: true })
  ratingsCount?: number = 0;

  @Field(() => Number, { nullable: true })
  reviewsCount?: number = 0;

  @Field(() => Number, { nullable: true })
  salesCount?: number = 0;

  // TODO not required
  @Field(() => Number, { nullable: true })
  viewsCount?: number = 0;

  // TODO earnings and stats

}


export const VendorTypeModelName = VendorType.name;

export const VendorModel: Model = new Model(VendorTypeModelName, {
  graphqlType: VendorType,
});