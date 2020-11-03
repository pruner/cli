import yargs, { CommandModule } from "yargs";
import { getGitTopDirectory } from "../git";
import { readFromFile, writeToFile } from "../io";
import { join } from "path";
import { allProviders, ProviderClass } from "../providers";
import * as chalk from "chalk";
import * as prompts from "prompts";
import * as _ from "lodash";
import { Command } from "./Command";

type Args = {
    provider: string
}

export default {
    command: "init <provider>",
    describe: "Set up Pruner for this project.",
    builder: yargs => yargs
        .positional("provider", {
            choices: allProviders.map(x => x.providerName)
        }),
    handler: async (args) => {
        const topDirectoryPath = await getGitTopDirectory();
        if(!topDirectoryPath) {
            console.error("Pruner requires that the current directory is in GIT.");
            return;
        }

        const Provider = allProviders.find(x => x.providerName === args.provider);

        const initSettings = await askForInitSettings(Provider);
        const existingSettings = await getProviderSettings(topDirectoryPath);

        const providers = existingSettings[args.provider] || [];
        providers.push(initSettings);

        existingSettings[args.provider] = providers;

        await persistProviderSettings(topDirectoryPath, existingSettings);

        console.log(chalk.green("Pruner has been initialized!"));
    }
} as Command<Args>;

async function persistProviderSettings(topDirectoryPath: string, existingSettings: any) {
    const settingsPath = getSettingsPath(topDirectoryPath);
    await writeToFile(
        settingsPath,
        JSON.stringify(existingSettings, null, '\t'));
}

function getSettingsPath(topDirectoryPath: string) {
    return join(topDirectoryPath, ".pruner", "settings.json");
}

async function getProviderSettings(topDirectoryPath: string) {
    const settingsPath = getSettingsPath(topDirectoryPath);
    return JSON.parse(await readFromFile(settingsPath)) || {};
}

async function askForInitSettings(Provider: ProviderClass<any, any>) {
    const initQuestions = Provider.getInitQuestions();
    
    const keys = _.keys(initQuestions);
    for (let key of keys) {
        initQuestions[key]["name"] = key;
    }

    const initSettings = await prompts(
        _.values(initQuestions) as prompts.PromptObject<any>[]);
    return initSettings;
}
