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

    @Field(() => String, { nullable: true })
    name?: string = "";

    @Field(() => String, { nullable: true })
    slogan?: string = "";

    @Field(() => String, { nullable: true })
    description?: string = "";

    @Field(() => Boolean, { nullable: true })
    ENABLE_BTC?: boolean = false;

    @Field(() => Boolean, { nullable: true })
    ENABLE_XMR?: boolean = false;

    @Field(() => String, { nullable: true })
    BTCPAYSERVER_URL?: string = "";

    @Field(() => String, { nullable: true })
    BTCPAYSERVER_BTC?: string = "";

    @Field(() => String, { nullable: true })
    BTCPAYSERVER_CRON_ENABLED?: string = "";

    @Field(() => String, { nullable: true })
    BTCPAYSERVER_CRON?: string = "";

    @Field(() => String, { nullable: true })
    WALLET_RPC_URL?: string = "";

    @Field(() => String, { nullable: true })
    WALLET_RPC_USER?: string = "";

    @Field(() => String, { nullable: true })

    WALLET_RPC_PASSWORD?: string = "";

    @Field(() => String, { nullable: true })
    WALLET_PATH?: string = "";

    @Field(() => String, { nullable: true })
    WALLET_PASSWORD?: string = "";

    @Field(() => String, { nullable: true })
    WALLETS_DIR?: string = "";

    @Field(() => String, { nullable: true })
    MONEROX_URL?: string = "";

    @Field(() => String, { nullable: true })
    MONEROX_WALLET?: string = "";

    @Field(() => String, { nullable: true })
    MONEROX_CRON?: string = "";

    @Field(() => Boolean, { nullable: true })
    ENABLE_XMPP?: boolean = false;

    @Field(() => String, { nullable: true })
    XMPP_HOST?: string = "";

    @Field(() => String, { nullable: true })
    XMPP_PORT?: string = "";

    @Field(() => String, { nullable: true })
    XMPP_JID?: string = "";

    @Field(() => String, { nullable: true })
    XMPP_PASSWORD?: string = "";

    @Field(() => Boolean, { nullable: true })
    ENABLE_PGP?: boolean = false;

    @Field(() => String, { nullable: true })
    PGP_PUBLIC_KEY?: string = "";

    @Field(() => String, { nullable: true })
    theme?: string = "";
     
}

export const siteSettingsClientSelectors = [
    "id",
    "vendorBond",
    "feePrices",
    "vendorCount",
    "userCount",
    "adCount",
    "name",
    "slogan",
    "description",
    "ENABLE_BTC",
    "ENABLE_XMR",
    "ENABLE_XMPP",
    "XMPP_JID",
    "ENABLE_PGP",
    "PGP_PUBLIC_KEY",
    "theme",
]
export const SiteSettingsModel = new Model(SiteSettings.name, {
    graphqlType: SiteSettings,
});

