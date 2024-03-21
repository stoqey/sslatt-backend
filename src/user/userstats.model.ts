import { Field, InputType, Model, ObjectType } from "couchset";

import { UserType } from "@roadmanjs/auth";

// use environment variables
export const VENDOR_MIN = 20;

@InputType("UserStatsInput")
@ObjectType()
export class UserStats {

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

  // Counts
  @Field(() => Number, { nullable: true })
  ratings?: number = 0;

  @Field(() => Number, { nullable: true })
  ratingsCount?: number = 0;

  @Field(() => Number, { nullable: true })
  orderCount?: number = 0;

  @Field(() => Number, { nullable: true })
  spent?: number = 0;

  // TODO not required
  @Field(() => Number, { nullable: true })
  viewsCount?: number = 0;

  // TODO trustLevel

}

export const UserStatsModelName = UserStats.name;

export const UserStatsModel: Model = new Model(UserStatsModelName, {
  graphqlType: UserStats,
});