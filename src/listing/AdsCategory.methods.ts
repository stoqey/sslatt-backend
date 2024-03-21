import AdCategoryModel from "./AdCategory.model";
import AdsListingModel from "./AdsListing.model";
import { awaitTo } from "couchset/dist/utils";
import { isEmpty } from "lodash";

// TODO use bull queue
export const upsertCategoryStats = async (subcategory: string): Promise<void> => {
    try {

        if (isEmpty(subcategory)) throw new Error("Category is required");

        const [errorListings, allAdsListing] = await awaitTo(AdsListingModel.pagination({
            where: {
                subcategory
            },
            // TODO page
            limit: 10000,
        }));

        if (errorListings) throw errorListings;

        if (isEmpty(allAdsListing)) throw new Error("Error not ads found");

        const count = allAdsListing?.length || 0;

        const [errorSub, subcategoryItem] = await awaitTo(AdCategoryModel.findById(subcategory));
        if (subcategoryItem) {
            const updatedSub = await AdCategoryModel.updateById(subcategoryItem.id, {
                ...subcategoryItem,
                count
            })
            console.log("updatedSub", updatedSub)
        }

        const [errorMain, mainCategory] = await awaitTo(AdCategoryModel.findById(subcategoryItem.category));
        if (mainCategory && subcategoryItem) {
            const oldSubcategoryCount = subcategoryItem.count || 0;
            const oldMainCategoryCount = mainCategory.count || 0;

            const newCategoryCount = oldMainCategoryCount <= 0 ? count : oldMainCategoryCount - oldSubcategoryCount + count;
            const updatedMainCat = await AdCategoryModel.updateById(mainCategory.id, {
                ...mainCategory,
                count: newCategoryCount
            })

            console.log("updatedMainCat", updatedMainCat)
        }

    }
    catch (error) {
        console.log("error updating category stats", error)
        return;
    }
}