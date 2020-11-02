import yargs from 'https://deno.land/x/yargs/deno.ts';

import DotNetCommand from './dotnet/DotNetCommand.ts';

yargs(Deno.args)
  .command(DotNetCommand)
  .strictCommands()
  .demandCommand(1)
  .argv