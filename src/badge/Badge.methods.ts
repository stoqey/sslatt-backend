// createBadgeByModel {owner, model}
// updateBadgeCount {id or owner + model, count+-}

import { Badge, BadgeModel } from "./Badge.model";

import { CouchbaseConnection } from "couchset";
import { awaitTo } from "couchset/dist/utils";
import { isEmpty } from "lodash";

export const createBadgeByModel = async (owner: string, model: string = owner): Promise<Badge | null> => {
    try {
        const [, existingBadge] = await awaitTo(BadgeModel.pagination({
            where: {
                owner,
                model
            }
        }));

        if (isEmpty(existingBadge) || !existingBadge) {
            return await BadgeModel.create({
                owner,
                model,
                count: 0
            });
        }
        return existingBadge && existingBadge[0]
    } catch (error) {
        console.log("error creating badge", error);
        return null;
    }
}

export const getBadges = async (owner: string, models: string[]): Promise<Badge[] | null> => {
    try {

        const bucket = CouchbaseConnection.Instance.bucketName;

        const query = `
        SELECT *
            FROM \`${bucket}\` badge
            WHERE badge._type = "${Badge.name}"
            AND badge.owner = "${owner}"
            AND badge.model in ${JSON.stringify(models)};
        `;

        const [errorFetching, data] = await awaitTo(BadgeModel.customQuery(
            {
                query: query,
                params: [owner, models],
                limit: 1000
            }
        ));

        if (errorFetching) {
            throw errorFetching;
        }

        const [existingBadge = []] = data;
        /**
         const createNewBadges = models.map(async (model) => {
            return await createBadgeByModel(owner, model);
        }
        const badges = await Promise.all(createNewBadges);
         */

        if (isEmpty(existingBadge) || !existingBadge) {
            return null;
        }

        return existingBadge.map((x: any) => BadgeModel.parse(x.badge));

    } catch (error) {
        console.log("error getting badge", error);
        return null;
    }
}

export const updateBadgeCount = async (owner: string, model: string, count: number) => {
    try {
        // find badge
        const [errorBadge, badge] = await awaitTo(createBadgeByModel(owner, model));
        if (errorBadge) {
            throw errorBadge;
        }
        if (!badge || isEmpty(badge)) {
            throw new Error("error updating badge count");
        }
        const currentCount = badge.count || 0;
        const newBadgeCount = currentCount + count;
        badge.count = newBadgeCount < 0 ? 0 : newBadgeCount;

        return await BadgeModel.updateById(badge.id, badge);
    } catch (error) {
        console.log("error updating badge count", error);
        return null;
    }
}