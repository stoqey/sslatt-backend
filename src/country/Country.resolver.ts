import {
  Arg,
  Query,
  Resolver,
  UseMiddleware
} from "type-graphql";
import { City, Country, State } from 'country-state-city';
import { CityType, CountryType, StateType } from "./Country.model";
import { isAuth } from "@roadmanjs/auth"
import _get from "lodash/get";

@Resolver()
export class CountryResolver {
  // getAllCountries
  // getStateByCountry
  // getCityByState

  @Query(() => [CountryType])
  @UseMiddleware(isAuth)
  async getAllCountries(): Promise<CountryType[]> {
    return Country.getAllCountries();
  }

  @Query(() => [StateType])
  @UseMiddleware(isAuth)
  async getStateByCountry(
    @Arg("countryCode") countryCode: string
  ): Promise<StateType[]> {
    return State.getStatesOfCountry(countryCode) as StateType[];
  }

  @Query(() => [CityType])
  @UseMiddleware(isAuth)
  async getCityByState(
    @Arg("countryCode") countryCode: string,
    @Arg("stateCode") stateCode: string
  ): Promise<CityType[]> {
    return City.getCitiesOfState(countryCode, stateCode) as CityType[];
  }

}

export default CountryResolver;
