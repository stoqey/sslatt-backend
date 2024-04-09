import 'cross-fetch/polyfill';
import "reflect-metadata";
import "dotenv/config";

import { OrderRatingResolver, OrderResolver } from './order';
import { RoadmanBuild, log, roadman } from "roadman";
import {
  TransactionDefaultResolver,
  btcpayserverRoadman,
  getWalletResolvers,
  moneroserverRoadman,
} from "@roadmanjs/wallet";
import { WithdrawRequestAdminResolver, WithdrawRequestResolver } from './withdrawRequest';
import { get as _get, isEmpty } from "lodash";

import AdCategoryResolver from "./listing/AdCategory.resolver";
import { AdsListingResolver } from './listing/AdsListing.model';
import { BadgeResolver } from './badge/Badge.resolver';
import CountryResolver from './country/Country.resolver';
import { NotificationResolver } from './notification';
import PgpResolver from './auth/Pgp.resolver';
import SettingsResolver from './settings/settings.resolver';
import UserAuthPwResolver from './auth/User.resolver.pw';
import UserAuthResolver from './auth/User.resolver.auth';
import VendorResolver from './vendor/vendor.resolver';
import { couchsetRoadman } from "@roadmanjs/couchset";
import { createDefaultIndexes } from './_startup';
import { getAdListingResolvers } from "./listing";
import { getAuthResolvers } from "@roadmanjs/auth";
import { getChatResolvers } from "@roadmanjs/chat";
import { getSocialResolvers } from "@roadmanjs/social";
import { mediaRoadman } from './media/media.app';
import { walletRouter as moneroxWalletRouter } from "@roadmanjs/monerox";
import { DisputeAdminResolver, DisputesResolver } from './disputes';

const resolvers = [
  ...getAuthResolvers(),
  ...getChatResolvers(),
  ...getSocialResolvers(),
  ...getWalletResolvers(),
  ...getAdListingResolvers(),
  AdsListingResolver,
  OrderResolver,
  OrderRatingResolver,
  WithdrawRequestResolver,
  WithdrawRequestAdminResolver,
  AdCategoryResolver,
  CountryResolver,
  VendorResolver,
  SettingsResolver,
  TransactionDefaultResolver,
  PgpResolver, UserAuthResolver, UserAuthPwResolver, NotificationResolver, BadgeResolver, DisputeAdminResolver, DisputesResolver
];

const app = async (args: RoadmanBuild): Promise<RoadmanBuild> => {
  const { app } = args;
  app.use("/wallet", moneroxWalletRouter);
  return args;
}

const run = async () => {
  const roadmanStarted = await roadman({
    roadmen: [
      app,
      mediaRoadman,
      couchsetRoadman,
      btcpayserverRoadman, moneroserverRoadman,
    ],
    resolvers,
  });

  if (roadmanStarted) {
    if (!isEmpty(process.env.STARTUP)) {
      log("startup", "running startup");
      setTimeout(async () => {
        log("roadmanStarted", roadmanStarted);
        await createDefaultIndexes();
      }, 3000);
    }
  }
};

run();
