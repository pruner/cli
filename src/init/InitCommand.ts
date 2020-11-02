import yargs, { CommandModule } from "yargs";
import * as prompts from "prompts";
import { getGitTopDirectory } from "../git";

type Args = {}

export default {
    command: "init",
    describe: "Set up Pruner for this project.",
    builder: yargs => yargs,
    handler: async (args: Args) => {
        console.log("init");

        const topDirectoryPath = await getGitTopDirectory();
        if(!topDirectoryPath) {
            console.error("Pruner requires that the current directory is in GIT.");
            return;
        }

        await prompts({
            type: 'text',
            name: 'value',
            message: 'How old are you?',
            instructions: "foobar instructions",
            validate: value => value < 18 ? `Nightclub is 18+ only` : true
        });
    }
} as CommandModule<typeof yargs, Args>;