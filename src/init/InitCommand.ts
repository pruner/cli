import yargs, { CommandModule } from "yargs";
import prompts from "prompts";

type Args = {}

export default {
    command: "init",
    describe: "Set up Pruner for this project.",
    builder: yargs => yargs,
    handler: async (args: Args) => {
        await prompts();
    }
} as CommandModule<typeof yargs, Args>;