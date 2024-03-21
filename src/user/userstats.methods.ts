import { UserStats, UserStatsModel } from "./userstats.model"

import { awaitTo } from "couchset/dist/utils";
import { isEmpty } from "lodash";

export const upsertUserStats = async (owner: string, data: any) => {
    try {
        const [errorExisting, existingStats] = await awaitTo(UserStatsModel.pagination({
            where: {
                owner,
            },
            limit: 1,
        }));

        if (errorExisting) {
            throw errorExisting;
        }

        if (existingStats && !isEmpty(existingStats)) {
            const stats = existingStats[0];
            // update
            const updatedStats = await UserStatsModel.updateById(stats.id, {
                ...stats,
                ...data
            });
            return updatedStats;
        }
        // create
        const stats: UserStats = {
            owner,
            ...data
        };

        const newStats = await UserStatsModel.create(stats);
        return newStats;

    } catch (error) {
        console.log("error upsert user stats", error);
        return null;
    }
}