import { SiteSettings, SiteSettingsModel, siteSettingsClientSelectors } from "./settings.model";

import { awaitTo } from "couchset/dist/utils";
import { initSiteSettings } from "../_startup/startup"
import { isEmpty, pick } from "lodash";
import { sign } from 'jsonwebtoken';

export const getSiteSettings = async (client = false): Promise<SiteSettings | null> => {
    try {
        const [err, settings] = await awaitTo(SiteSettingsModel.findById(initSiteSettings.id));

        if (err) {
            throw err;
        }

        if (isEmpty(settings)) {
            throw new Error("error getting site settings");
        }

        if(client){
            return pick(settings, siteSettingsClientSelectors) as SiteSettings;
        }
        
        return settings;
    } catch (error) {
        console.error("error getting site settings", error);
        return null;
    }
}

interface UpsertSiteStats {
    user?: boolean;
    vendor?: boolean;
    ad?: boolean;
};

export const upsertSiteStats = async (args: UpsertSiteStats): Promise<SiteSettings | null> => {
    const { user = false, vendor = false, ad = false } = args;
    try {

        if (!user && !vendor && !ad) {
            return null;
        }

        const settings = await getSiteSettings();

        if (!settings) {
            throw new Error("error getting site settings");
        };

        if (user) {
            const currentUserCount = settings?.userCount || 0;
            settings.userCount = currentUserCount + 1;
        }

        if (vendor) {
            const currentVendorCount = settings?.vendorCount || 0;
            settings.vendorCount = currentVendorCount + 1;
        }

        if (ad) {
            const currentAdCount = settings?.adCount || 0;
            settings.adCount = currentAdCount + 1;
        };

        const updatedSettings = await SiteSettingsModel.updateById(initSiteSettings.id, settings);

        return updatedSettings;
    } catch (error) {
        console.error("error getting site settings", error);
        return null;
    }
}

export const getCSRFToken = () => {

    const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return sign({ userId: `anonymous_${randomString}` }, process.env.ACCESS_TOKEN_SECRET!, {
        expiresIn: '180s',
    });

}