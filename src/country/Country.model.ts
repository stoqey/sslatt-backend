import { Field, ObjectType } from "couchset";

@ObjectType()
export class TimezoneType {
  @Field(() => String, { nullable: true, description: "" })
  zoneName?: string = "";

  @Field(() => Number, { nullable: true, description: "" })
  gmtOffset?: number = 0;

  @Field(() => String, { nullable: true, description: "" })
  gmtOffsetName?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  abbreviation?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  tzName?: string = "";

}

@ObjectType()
export class CountryType {
  @Field(() => String, { nullable: true, description: "" })
  isoCode?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  name?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  phonecode?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  flag?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  currency?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  latitude?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  longitude?: string = "";

  @Field(() => [TimezoneType], { nullable: true, description: "" })
  timezones?: TimezoneType[] = [];
}

@ObjectType()
export class StateType {

  @Field(() => String, { nullable: true, description: "" })
  isoCode?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  name?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  countryCode?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  latitude?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  longitude?: string = "";
}


@ObjectType()
export class CityType {

  @Field(() => String, { nullable: true, description: "" })
  isoCode?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  name?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  countryCode?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  stateCode?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  latitude?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  longitude?: string = "";
}