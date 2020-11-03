import { CommandModule } from "yargs";
import yargs = require("yargs");

export type Command<TArgs> = CommandModule<typeof yargs, TArgs & {
    verbosity?: "normal" | "verbose"
}>