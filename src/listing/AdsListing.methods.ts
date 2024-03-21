import AdsListingModel, { AdsListingType } from "./AdsListing.model";
import _, { get as _get, isEmpty } from "lodash";

export const getDistanceFromZoom = (zoom: number): number => {
  // Default for KM units
  const distance = {
    "20": 1, // 1128.497220,
    "19": 5, // 2256.994440,
    "18": 10, // 4513.988880,
    "17": 50, // 9027.977761, // 1km
    "16": 80, // 18055.955520, // 100m
    "15": 100, // 36111.911040,
    "14": 200, // 72223.822090, //
    "13": 300, // 144447.644200,  // 1km
    "12": 400, // 288895.288400, // 5km
    "11": 500, // 577790.576700, // 10 km
    "10": 600, // 1155581.153000, // 30km
    "9": 700, // 2311162.307000, // 50 km
    "8": 800, // 4622324.614000, // 80 km
    "7": 900, // 9244649.227000, // 100 km
    "6": 1000, // 18489298.450000, // 150 km
    "5": 1000, // 36978596.910000, // 200km
    "4": 1000, // 73957193.820000, // 300km
    "3": 1000, // 147914387.600000,
    "2": 1000, // 295828775.300000,
    "1": 1000, // 591657550.500000
  };

  // use other units below

  // @ts-ignore
  const currentDistance = distance[`${Math.round(zoom)}`];
  return currentDistance;
};

export const getSearchLimitFromZoom = (zoom: number): number => {
  // Default for KM units
  const distance = {
    "20": 500, // 1128.497220,
    "19": 500, // 2256.994440,
    "18": 500, // 4513.988880,
    "17": 500, // 9027.977761, // 1km
    "16": 500, // 18055.955520, // 100m
    "15": 1000, // 36111.911040,
    "14": 2000, // 72223.822090, //
    "13": 2000, // 144447.644200,  // 1km
    "12": 2500, // 288895.288400, // 5km
    "11": 3000, // 577790.576700, // 10 km
    "10": 3500, // 1155581.153000, // 30km
    "9": 4000, // 2311162.307000, // 50 km
    "8": 5000, // 4622324.614000, // 80 km
    "7": 6000, // 9244649.227000, // 100 km
    "6": 6000, // 18489298.450000, // 150 km
    "5": 6000, // 36978596.910000, // 200km
    "4": 6000, // 73957193.820000, // 300km
    "3": 6000, // 147914387.600000,
    "2": 6000, // 295828775.300000,
    "1": 6000, // 591657550.500000
  };

  // use other units below

  // @ts-ignore
  const currentDistance = distance[`${Math.round(zoom)}`];
  return currentDistance;
};


export const upsertViews = async (ad: AdsListingType) => {
  const currentViews = ad.viewsCount || 0;

  try {

    await AdsListingModel.updateById(ad.id as string, {
      ...ad,
      viewsCount: currentViews + 1,
    });
  }
  catch (error) {
    console.log("error upsert views", error)
  }

  finally {
    return true;
  }
}
