#!/usr/bin/env node

import yargs from 'yargs';

import InitCommand from './commands/InitCommand';
import RunCommand from './commands/RunCommand';

export default yargs(process.argv.slice(2))
  .scriptName("pruner")
  .option("verbosity", {
    alias: "v",
    choices: [
      "normal", 
      "verbose"
    ],
    demandOption: false
  })
  .command(InitCommand as any)
  .command(RunCommand as any)
  .help();