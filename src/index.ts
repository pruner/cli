import yargs from 'yargs';
import DotNetCommand from './dotnet/DotNetCommand';
import InitCommand from './init/InitCommand';

var argv = require('yargs/yargs')(process.argv.slice(2)).argv;

export default yargs(argv)
  .scriptName("pruner")
  .command(InitCommand as any)
  .command(DotNetCommand as any)
  .demandCommand(1)
  .help()
  .argv