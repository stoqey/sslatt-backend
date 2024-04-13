import 'cross-fetch/polyfill';
import "reflect-metadata";
import "dotenv/config";

import { get as _get } from "lodash";
import { siteConfigSetEnv } from './settings/settings.methods';

const run = async () => {
  await siteConfigSetEnv();
  await import("./app");
};

run();
