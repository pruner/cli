import yargs from 'yargs';

import InitCommand from './commands/InitCommand';
import RunCommand from './commands/RunCommand';

var argv = require('yargs/yargs')(process.argv.slice(2)).argv;

export default yargs(argv)
  .scriptName("pruner")
  .command(InitCommand as any)
  .command(RunCommand as any)
  .demandCommand(1)
  .help()
  .argv