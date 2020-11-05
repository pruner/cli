import { CommandModule } from "yargs";
import yargs from "yargs";

export type DefaultArgs = {
    verbosity?: "normal" | "verbose";
}

export type Command<TArgs> = CommandModule<typeof yargs, TArgs>