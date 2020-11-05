import git from "../git";
import io from "../io";
import { join } from "path";
import { allProviders, ProviderClass } from "../providers";
import chalk from "chalk";
import prompts from "prompts";
import _ from "lodash";
import { Command } from "./Command";

type Args = {
    provider: string
}

export default {
    command: "init <provider>",
    describe: "Set up Pruner for this project.",
    builder: yargs => yargs
        .positional("provider", {
            choices: allProviders.map(x => x.providerName),
            demandOption: true
        }),
    handler: async (args) => {
        const topDirectoryPath = await git.getGitTopDirectory();
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

        await io.writeToPrunerFile(
            ".gitignore", 
            [
                "temp/"
            ].join("\n"));

        console.log(chalk.green("Pruner has been initialized!"));
    }
} as Command<Args>;

async function persistProviderSettings(topDirectoryPath: string, existingSettings: any) {
    const settingsPath = getSettingsPath(topDirectoryPath);
    await io.writeToFile(
        settingsPath,
        JSON.stringify(existingSettings, null, '\t'));
}

function getSettingsPath(topDirectoryPath: string) {
    return join(topDirectoryPath, ".pruner", "settings.json");
}

async function getProviderSettings(topDirectoryPath: string) {
    const settingsPath = getSettingsPath(topDirectoryPath);
    return JSON.parse(await io.readFromFile(settingsPath)) || {};
}

async function askForInitSettings(Provider: ProviderClass<any>) {
    const initQuestions = Provider.getInitQuestions();
    
    const keys = _.keys(initQuestions);
    for (let key of keys) {
        initQuestions[key]["name"] = key;
    }

    const initSettings = await prompts(
        _.values(initQuestions) as prompts.PromptObject<any>[]);
    return initSettings;
}
