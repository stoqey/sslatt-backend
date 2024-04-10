import { FeePrices, SiteSettings } from "./settings.model"
import {
  Field,
  ObjectType,
  Query,
} from "couchset";
import {
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { getCSRFToken, getSiteSettings } from "./settings.methods";

import _get from "lodash/get";
import { initSiteSettings } from "../_startup/startup";
import { isAuth } from "@roadmanjs/auth";

@Resolver()
export class SettingsResolver {

  // @deprecated
  @Query(() => FeePrices, { nullable: false })
  @UseMiddleware(isAuth)
  async getFeePrices(): Promise<FeePrices> {
    const siteSettings = await getSiteSettings(true);
    return (siteSettings?.feePrices ? siteSettings.feePrices : initSiteSettings.feePrices) as any;
  }

  @Query(() => SiteSettings, { nullable: false })
  async getSiteSettings(): Promise<SiteSettings> {
    const siteSettings = await getSiteSettings(true);
    return siteSettings ? siteSettings : initSiteSettings;
  }

  @Query(() => String, { nullable: true })
  async getCSRFToken(): Promise<String> {
    const csrf = await getCSRFToken();
    return csrf;
  }

}

export default SettingsResolver;
