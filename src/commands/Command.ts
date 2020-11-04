import { CommandModule } from "yargs";
import yargs from "yargs";

export type Command<TArgs> = CommandModule<typeof yargs, TArgs & {
    verbosity?: "normal" | "verbose";
    workingDirectory?: string;
}>