import yargs from 'yargs';

import InitCommand from './commands/InitCommand';
import RunCommand from './commands/RunCommand';

console.debug = () => {};

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
  .option("working-directory", {
    alias: "wd",
    demandOption: false
  })
  .command(InitCommand as any)
  .command(RunCommand as any)
  .demandCommand(1)
  .help()
  .argv