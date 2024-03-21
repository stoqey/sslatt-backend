import "reflect-metadata";

import AdCategoryModel, { AdCategoryType } from "../listing/AdCategory.model";
import { get as _get, flatten, isEmpty, omit } from "lodash";
import { createAdminUser, createSiteSettings } from "./startup";

import { CouchbaseConnection } from "couchset";
import adCategories from "../_config/categories";
import { awaitTo } from "couchset/dist/utils";
import { createUpdate } from "couchset";
import { log } from "roadman";

const mapAdCategories = () => flatten(adCategories.map((category) => {

    // root category
    const categories = category.categories || [];

    const allCategories = categories.map((subcategory) => {

        const subcategories = subcategory.subcategories || [];

        const allCats = [
            // main category
            {
                id: subcategory.id,
                name: subcategory.name,
            }
        ];

        const subCats = subcategories.map((sub) => {
            return {
                ...sub, // name
                category: subcategory.id,
            }
        });


        return [...allCats, ...subCats];
    });

    return flatten(allCategories);

}));


const createAdCategories = async () => {
    try {
        const cats = mapAdCategories();

        const createCategories = await Promise.all(cats.map(async (category) => {
            const [_errorCat, existingCat] = await awaitTo(AdCategoryModel.findById(category.id));

            if (!isEmpty(existingCat) || !_errorCat) {
                return AdCategoryModel.updateById(category.id, {
                    ...existingCat,
                    ...category,
                })
            }
            // create new
            return await createUpdate<AdCategoryType>({
                model: AdCategoryModel,
                data: {
                    ...category,
                }
            })

        }));

        return createCategories;

    }
    catch (error) {
        console.log("error creating ad categories", error);
        return null;
    }
}

// console.log("mapAdCategories", mapAdCategories());


export const createDefaultIndexes = async () => {
    try {
        log("createDefaultIndexes", createDefaultIndexes);
        const cluster = CouchbaseConnection.Instance.cluster;
        const bucket = CouchbaseConnection.Instance.bucketName;

        const indexes = [
            `CREATE PRIMARY INDEX \`#primary\` ON \`${bucket}\``,
            `CREATE INDEX \`adv_convoId_type_createdAt\` ON \`${bucket}\`(\`convoId\`,\`_type\`,\`createdAt\`)`,
            `CREATE INDEX \`adv_owner_type\` ON \`${bucket}\`(\`owner\`,\`_type\`)`,
            `CREATE INDEX \`adv_type\` ON \`${bucket}\`(\`_type\`)`,
            `CREATE INDEX \`adv_type_city_country_firstname_address_lastname_phone_fullname\` ON \`${bucket}\`(\`_type\`,\`city\`,\`country\`,\`firstname\`,\`address\`,\`lastname\`,\`phone\`,\`fullname\`)`,
            `CREATE INDEX \`adv_type_email_phone\` ON \`${bucket}\`(\`_type\`,\`email\`,\`phone\`)`,
            `CREATE INDEX \`adv_type_id_email_phone\` ON \`${bucket}\`(\`_type\`,\`id\`,\`email\`,\`phone\`)`,
            // `CREATE INDEX \`adv_acos_sin_radians_43_759844705560425_multi_sin_radians_geo_la2911473659\` ON \`${bucket}\`((acos(((sin(radians(43.759844705560425)) * sin(radians((\`geo\`.\`lat\`)))) + ((cos(radians(43.759844705560425)) * cos(radians((\`geo\`.\`lat\`)))) * cos((radians((\`geo\`.\`lon\`)) - radians((-79.47658378906253))))))) * 6371),(\`geo\`.\`lat\`))`,
            `CREATE INDEX \`adv_seller\` ON \`${bucket}\`(\`seller\`)`,
            `CREATE INDEX \`adv_type_category\` ON \`${bucket}\`(\`_type\`,\`category\`)`,
            `CREATE INDEX \`adv_type_email_username_address_website_lastname_id_admin_bio_fi2948011380\` ON \`${bucket}\`(\`_type\`,\`email\`,\`username\`,\`address\`,\`website\`,\`lastname\`,\`id\`,\`admin\`,\`bio\`,\`firstname\`,\`fullname\`,\`tokenVersion\`,\`hash\`,\`createdAt\`,\`coverImage\`,\`avatar\`,\`zipcode\`,\`currency\`,\`city\`,\`phone\`,\`state\`,\`country\`,\`balance\`,\`plans\`)`,
            `CREATE INDEX \`adv_type_email_phone_id_fullname_avatar_country_website_lastname3970495917\` ON \`${bucket}\`(\`_type\`,\`email\`,\`phone\`,\`id\`,\`fullname\`,\`avatar\`,\`country\`,\`website\`,\`lastname\`,\`firstname\`,\`createdAt\`,\`bio\`,\`address\`,\`username\`)`,
            `CREATE INDEX \`adv_type_owner_createdAt\` ON \`${bucket}\`(\`_type\`,\`owner\`,\`createdAt\`)`,
            `CREATE INDEX \`adv_visible_type\` ON \`${bucket}\`(\`visible\`,\`_type\`)`,
            `CREATE INDEX \`adv_visible_type_ad_createdAtDESC_price_photos_refUrl_paid_city_296265671\` ON \`${bucket}\`(\`visible\`,\`_type\`,(\`ad\`.\`createdAt\`) DESC,\`price\`,\`photos\`,\`refUrl\`,\`paid\`,\`city\`,\`state\`,\`prices\`,\`deleted\`,\`owner\`,\`weight\`,\`updatedAt\`,\`description\`,\`ratingsCount\`,\`reviewsCount\`,\`age\`,\`geo\`,\`country\`,\`ethnicity\`,\`availability\`,\`id\`,\`ratings\`,\`adId\`,\`title\`,\`createdAt\`,\`eye\`,\`env\`,\`name\`,\`phone\`,\`height\`,\`zipCode\`,\`category\`,\`hair\`,\`info\`,\`email\`,\`status\`,\`address\`)`,
            `CREATE INDEX adv_currency_type_owner ON \`dev\`(\`currency\`,\`_type\`,\`owner\`)`,
            `CREATE INDEX adv_transactionHash_createdAtDESC_type ON \`dev\`(\`transactionHash\`,\`createdAt\` DESC) WHERE \`_type\` = 'WithdrawRequest'`,
        ];

        console.log("create indexes", indexes)

        const createIndex = (indexQuery: string) =>
            new Promise((resolve, reject) =>
                cluster
                    .query(indexQuery)
                    .then((results) => {
                        resolve(results);
                    })
                    .catch((error) => resolve(null))
            );

        const createdIndexes = await Promise.all(
            indexes.map((index) => createIndex(index))
        );

        console.log("createdIndex", createdIndexes);

        const createdAdCategories = await createAdCategories();
        console.log("createdAdCategories", createdAdCategories && createdAdCategories.length);

        await createAdminUser();

        await createSiteSettings();
    } catch (error) {
        console.log("error creating default indexes", error);
    }
};
