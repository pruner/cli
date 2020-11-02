# cli
The Pruner CLI that reduces the amount of time spent running tests.

# To do
- Providers (dotnet)

`pruner dotnet`

```
await execa("docker-compose", [
    ...this.getFilesArguments(args),
    "--project-name",
    chunk.name,
    "run",
    "--service-ports",
    "--use-aliases",
    "--volume",
    `${chunk.hostMachineDirectoryPath}:/.pruner`,
    "--entrypoint",
    "/bin/sh",
    serviceName,
    "-c",
    `dotnet test --no-build --verbosity normal --filter "${testFilter}" --logger "junit;LogFilePath=/.pruner/${individualReportFileName}"`
], {
    cwd: args.cwd
});
```