# What is this?
The Pruner CLI only runs the tests that are affected by your pending GIT changes. 
In addition, it also has a Visual Studio Code extension that highlights coverage on the fly.

[![Watch a demo-video](/assets/Pruner.gif)](https://github.com/pruner/cli/blob/main/assets/Pruner.webm?raw=true)

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
