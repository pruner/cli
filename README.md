# What is this?
The Pruner CLI is a wrapper around your default way of running tests, to only run the tests that have been affected by your GIT pending changes, to significantly boost performance.

# Optional: Get the Visual Studio Code extension
https://marketplace.visualstudio.com/items?itemName=Pruner.vscode

# Installing the CLI
`npm i @pruner/cli -g`

# Language & framework support
## `dotnet` (C# .NET, VB .NET)
Recipe: https://github.com/pruner/cli/blob/main/docs/dotnet.md

# Running tests
When you want to run your tests, use:

`pruner run`

# Watch mode
There's also a watch mode available:

`pruner run --watch`

# Contributing
To contribute, you need to have the following installed:
- .NET SDK 5
