import { Field, InputType, Model, ObjectType } from "couchset";

@InputType()
@ObjectType()
export class PgpPublicKey {
  @Field(() => String, { nullable: true })
  id?: string = "";

  @Field(() => Date, { nullable: true })
  createdAt?: Date = new Date();

  @Field(() => Date, { nullable: true })
  updatedAt?: Date = new Date();

  @Field(() => Boolean, { nullable: true })
  deleted?: boolean = false;

  @Field(() => String, { nullable: true, description: "" })
  owner?: string = "";

  @Field(() => String, { nullable: false, description: "" })
  key: string = "";

  @Field(() => Boolean, { nullable: true, description: "", defaultValue: false })
  verified?: boolean = false;

}

@ObjectType({ description: "PGP Public Key Code, expires in 60 sec" })
export class PgpPublicKeyCode {

  @Field(() => String, { nullable: true })
  id?: string = "";

  @Field(() => Date, { nullable: true })
  createdAt?: Date = new Date();

  @Field(() => Date, { nullable: true })
  updatedAt?: Date = new Date();

  @Field(() => Boolean, { nullable: true })
  deleted?: boolean = false;

  @Field(() => Number, { nullable: true, description: "Number of times confirmCode has been attempted", defaultValue: 0 })
  attempts?: number = 0;

  @Field(() => String, { nullable: true, description: "" })
  encryptedCode?: string = "";

  @Field(() => String, { nullable: true, description: "PgpPublicKey ID" })
  publicKeyId?: string = "";

  @Field(() => String, { nullable: true, description: "" })
  value?: string = "";
}


export const PgpPublicKeyModel: Model = new Model(PgpPublicKey.name, {
  graphqlType: PgpPublicKey,
});

export const PgpPublicKeyCodeModel: Model = new Model(PgpPublicKeyCode.name, {
  graphqlType: PgpPublicKeyCode,
});

