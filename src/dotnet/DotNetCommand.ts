import yargs, { CommandModule } from "yargs";
import { run } from "../runner";
import DotNetProvider from "./DotNetProvider";

type Args = {
    ["working-directory"]: string;
    ["project-directory-glob"]: string;
}

export default {
    command: "dotnet",
    describe: "Use the .NET provider.",
    builder: yargs => yargs
        .option("project-directory-glob", {
            type: "string",
            alias: "p",
            default: '**/*.Tests'
        })
        .option("working-directory", {
            type: "string",
            alias: 'w',
            default: ''
        }),
    handler: async (args: Args) => {
        const provider = new DotNetProvider(
            args["working-directory"],
            args["project-directory-glob"]);
        await run(provider);
    }
} as CommandModule<typeof yargs, Args>;