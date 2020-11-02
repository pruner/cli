import { CommandHandlerDefinition } from "https://deno.land/x/yargs@v16.1.0-deno/lib/command.ts";
import { YargsType } from "https://deno.land/x/yargs@v16.1.0-deno/types.ts";

export default {
    command: "dotnet",
    describe: "Run tests for dotnet.",
    builder: (yargs: YargsType) => yargs
        .command()
} as CommandHandlerDefinition;