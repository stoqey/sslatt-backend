import { Field, InputType, Model, ObjectType } from "couchset";

@ObjectType()
class WithdrawMin {
    @Field(() => Number, { nullable: false })
    BTC: number;

    @Field(() => Number, { nullable: true })
    XMR?: number;

};

@ObjectType()
export class FeePrices {
    @Field(() => WithdrawMin, { nullable: false })
    withdrawMin: WithdrawMin;

    @Field(() => Number, { nullable: false })
    withdrawFeePerc: number;

    @Field(() => Number, { nullable: false })
    checkoutFeePerc: number;
};

@InputType("SiteSettingsInput")
@ObjectType()
export class SiteSettings {
    @Field(() => String, { nullable: false })
    id: string = "";

    @Field(() => Number, { nullable: false })
    vendorBond: number = 600;

    @Field(() => FeePrices, { nullable: false })
    feePrices: FeePrices = null as any;

    @Field(() => Number, { nullable: true })
    vendorCount?: number = 0;

    @Field(() => Number, { nullable: true })
    userCount?: number = 0;

    @Field(() => Number, { nullable: true })
    adCount?: number = 0;
}

export const SiteSettingsModel = new Model(SiteSettings.name, {
    graphqlType: SiteSettings,
});

