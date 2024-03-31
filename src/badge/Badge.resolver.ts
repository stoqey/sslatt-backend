import { Resolver, Query, Arg, UseMiddleware, Ctx } from "couchset";
import { log } from "roadman";
import { Badge } from "./Badge.model";
import { getBadges } from "./Badge.methods";
import { ContextType, isAuth } from "@roadmanjs/auth";
import _get from "lodash/get";
import { isEmpty } from "lodash";

@Resolver()
export class BadgeResolver {
    @Query(() => [Badge])
    @UseMiddleware(isAuth)
    async getBadges(
        @Ctx() ctx: ContextType,
        @Arg("models",() => [String], { nullable: false }) models: string[]
    ): Promise<Badge[] | null> {
        try {

            const owner = _get(ctx, 'payload.userId', '');
            const badges = await getBadges(owner, models);
            if (!badges || isEmpty(badges)) {
                throw new Error("not found");
            }
            return badges;
        } catch (error) {
            log("error getting Ad category", error);
            return null;
        }
    }
}