import { SiteSettings, SiteSettingsModel, siteSettingsClientSelectors } from "./settings.model";
import Queue from "bull"
import { awaitTo } from "couchset/dist/utils";
import { initSiteSettings } from "../_startup/startup"
import { isEmpty, map, omit, pick, set } from "lodash";
import { sign } from 'jsonwebtoken';
import { REDIS_URL, verbose } from 'roadman';
import { couchsetRoadman } from "@roadmanjs/couchset";

const queueName = "site-stats";
const siteStatsQueue = new Queue(queueName, REDIS_URL, {});
siteStatsQueue.on(`global:${queueName}:refresh`, () => {
    console.log(`global:${queueName}:refresh`);
    process.exit(0);
});
siteStatsQueue.process(async (job, done) => {
    console.log(`Processing job ${job.id}`);
    console.log(job.data);
    done();
});

export const siteConfigSetEnv = async () => {
    await couchsetRoadman(null as any);
    const siteSettings = await getSiteSettings();
    if (siteSettings) {
      const config = omit(siteSettings, ["feePrices", "_type", "_scope"]);
  
      const configEnvs = map(config, (value, key) => {
        return { [key]: value?.toString() };
      }).reduce((acc, curr) => {
        return { ...acc, ...curr };
      }, {});
  
      verbose("configEnvs", configEnvs);
  
      process.env = { ...process.env, ...configEnvs };
    };
}

export const emitSiteSettingsRefresh = (): void => {
    setTimeout(() => {
        const job = siteStatsQueue.emit(`global:${queueName}:refresh`);
        return job;
    }, 3000);
}
// export const siteStatsQueue = () => {

// };

export const getSiteSettings = async (client = false): Promise<SiteSettings | null> => {
    try {
        const [err, settings] = await awaitTo(SiteSettingsModel.findById(initSiteSettings.id));

        if (err) {
            throw err;
        }

        if (isEmpty(settings)) {
            throw new Error("error getting site settings");
        }

        if (client) {
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