import yargs from 'yargs';
import DotNetCommand from './dotnet/DotNetCommand';
var argv = require('yargs/yargs')(process.argv.slice(2)).argv;

yargs(argv)
  .scriptName("pruner")
  .command(InitCommand)
  .command(DotNetCommand)
  .demandCommand(1)
  .help()
  .argv