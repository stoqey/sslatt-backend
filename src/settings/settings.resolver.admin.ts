import { FeePrices, SiteSettings, SiteSettingsModel } from "./settings.model"
import {
  Arg,
  Field,
  Mutation,
  ObjectType,
  Query,
  ResType,
} from "couchset";
import {
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { getCSRFToken, getSiteSettings } from "./settings.methods";

import _get from "lodash/get";
import { initSiteSettings } from "../_startup/startup";
import { isAuth, isAdmin } from "@roadmanjs/auth";
import { isEmpty } from "lodash";

@Resolver()
export class AdminSettingsResolver {

  @Query(() => SiteSettings, { nullable: false })
  @UseMiddleware(isAuth)
  @UseMiddleware(isAdmin)
  async allSiteSettings(): Promise<SiteSettings> {
    const siteSettings = await getSiteSettings();
    return siteSettings ? siteSettings : initSiteSettings;
  }

  @Mutation(() => ResType, { nullable: false })
  @UseMiddleware(isAuth)
  @UseMiddleware(isAdmin)
  async updateSiteSettings(
    @Arg('args', () => SiteSettings, { nullable: true }) args?: SiteSettings,
  ): Promise<ResType> {
    try {

      if (isEmpty(args)) {
        throw new Error("error args cannot be empty");
      }

      const siteSettings = await getSiteSettings();
      if (!siteSettings) {
        throw new Error("error getting site settings");
      }
      // TODO validate args
      const newSiteSettings = { ...siteSettings, ...args };
      const updatedSiteSettings = await SiteSettingsModel.updateById(siteSettings.id, newSiteSettings);

      // TODO restart
      return { success: true, data: updatedSiteSettings };

    }
    catch (error) {
      console.log("error updating site settings", error)
      return { success: false, message: error.message };
    }

  }

}

export default AdminSettingsResolver;
