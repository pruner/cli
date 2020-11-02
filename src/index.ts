import yargs from 'yargs';
import DotNetCommand from './dotnet/DotNetCommand';
import InitCommand from './init/InitCommand';

export default yargs(process.argv.slice(2))
  .scriptName("pruner")
  .command(InitCommand as any)
  .command(DotNetCommand as any)
  .demandCommand(1)
  .help()
  .argv