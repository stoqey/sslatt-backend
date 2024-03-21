import {
  Resolver,
  Query,
  Arg} from "type-graphql";
import _get from "lodash/get";
import _, {  } from "lodash";
import { log } from "@roadmanjs/logs";
import AdCategoryModel, { AdCategoryType } from "./AdCategory.model";
@Resolver()
export class AdCategoryResolver {
  @Query(() => AdCategoryType)
  async getAdCategory(
    @Arg("id", { nullable: false }) id: string
  ): Promise<AdCategoryType | null> {
    try {
      const foundListing = await AdCategoryModel.findById(id);
      if (!foundListing) {
        throw new Error("not found");
      }

      return foundListing;
    } catch (error) {
      log("error getting Ad category", error);
      return null;
    }
  }

  @Query(() => [AdCategoryType])
  async getAdCategories(): Promise<AdCategoryType[]> {
    try {

      const foundCategories = await AdCategoryModel.pagination({
        limit: 10000
      });

      if (!foundCategories) {
        throw new Error("not found");
      }

      return foundCategories;
    } catch (error) {
      log("error getting Ad category", error);
      return [];
    }
  }

  // admin
  // createUpdate
}

export default AdCategoryResolver;
