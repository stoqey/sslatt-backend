import { VendorModel, VendorType } from "./vendor.model";

import { awaitTo } from "couchset/dist/utils";
import { isEmpty } from "lodash";

export const getVendorStore = async (seller: string): Promise<VendorType | null> => {
    try {
        if (isEmpty(seller)) throw new Error('seller not defined');
        const store = await VendorModel.pagination({
            where: {
                owner: seller
            },
            limit: 1
        });
        return store[0];

    }
    catch (error) {
        console.log("error getting vendor", error)
        return null;
    }
};

export const upsertVendorStats = async (seller: string, data: any) => {
    try {
        const [errorExisting, existingVendors] = await awaitTo(VendorModel.pagination({
            where: {
                owner: seller,
            },
            limit: 1,
        }));

        if (errorExisting) {
            throw errorExisting;
        }

        if (existingVendors && !isEmpty(existingVendors)) {
            const vendor = existingVendors[0];
            // TODO update stats

            const updatedStats = await VendorModel.updateById(vendor.id, {
                ...vendor,
                ...data
            });
            return updatedStats;
        }

        throw new Error("Vendor not found");

    } catch (error) {
        console.log("error upsert user stats", error);
        return null;
    }
}