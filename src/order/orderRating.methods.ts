import OrderRatingModel from "./orderRating.model";
import compact from "lodash/compact";
import isEmpty from "lodash/isEmpty";
import sumBy from "lodash/sumBy";
import { verbose } from "@roadmanjs/logs";

interface RatingsReviews {
    ratings: number;
    ratingsCount: number;
    reviewsCount: number;
}

export const getRatingsReviews = async (filters: any): Promise<Partial<RatingsReviews | null>> => {
    try {

        const orderRatings = await OrderRatingModel.pagination({
            where: filters,
            limit: 10000
        });

        const ratings = sumBy(orderRatings, "rating");
        const ratingsCount = orderRatings.length + 1;
        const allReviewsCount = compact(orderRatings.map(or => !isEmpty(or.review)));

        return {
            ratings: ratings / ratingsCount,
            ratingsCount,
            reviewsCount: allReviewsCount.length + 1,
        };

    }
    catch (error) {
        console.log(error);
        return null;
    }

}


interface UpsertRatingsReviews {
    filters: any;
    table: {
        model: any;
        item: any;
    }
};

/**
 * 
 * @param args
 * 
 */
export const upsertRatingsReviews = async (args: UpsertRatingsReviews) => {
    const { filters, table } = args;
    try {

        const ratingsReviews = await getRatingsReviews(filters);

        if (ratingsReviews) {

            const { ratings, ratingsCount, reviewsCount } = ratingsReviews;

            // TODO when no id?
            const update = await table.model.updateById(table.item.id, {
                ...table.item,
                ratings,
                ratingsCount,
                reviewsCount,
            });

            verbose("upsertRatingsReviews update", update)
            return update;
        }

    }
    catch (error) {
        console.log("error upsertRatingsReviews", error)
        return null;
    }
}