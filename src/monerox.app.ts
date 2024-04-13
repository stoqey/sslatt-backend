// custom roadman 
import 'cross-fetch/polyfill';
import "reflect-metadata";
import "dotenv/config";

import { Query, Resolver } from 'type-graphql';
import { RoadmanBuild, roadman, log } from "roadman";
import { walletRouter as moneroxWalletRouter, listenMain } from "@roadmanjs/monerox";
import { initConfigSiteSettings } from "./settings/settings.methods";

@Resolver()
class ExampleResolver {
    @Query(() => [String], { nullable: true })
    async apps(): Promise<string[]> {
        // fake async in this example
        return ['Apps', 'one', 'two'];
    }
}

const customRoadmanApp = async (args: RoadmanBuild): Promise<RoadmanBuild> => {
    const { app } = args;
    app.use("/wallet", moneroxWalletRouter());
    return args;
}

const run = async () => {

    await initConfigSiteSettings();

    const roadmanStarted = await roadman({
        roadmen: [
            customRoadmanApp
        ],
        resolvers: [ExampleResolver]
    });

    if(roadmanStarted){
        await listenMain();
        log("roadmanStarted", roadmanStarted);
    }
};

run();