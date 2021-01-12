# What is this?
Pruner is a universal test CLI that does the following:

- Runs your tests as soon as the code updates.
- Only runs the tests that are needed (the tests that run through the code you changed).
- Highlights code coverage with test status next to each line (see video below), so you know if you broke something, as you write it.
- Runs on your build server as well. Avoid wasting time waiting for your build server to run tests you already ran locally.

# Optional: Get the Visual Studio extension
- **Visual Studio Code:** https://marketplace.visualstudio.com/items?itemName=Pruner.vscode
- **Visual Studio:** https://marketplace.visualstudio.com/items?itemName=Pruner.vs

[![Watch a demo-video](/assets/Pruner.gif)](https://github.com/pruner/cli/blob/main/assets/Pruner.webm?raw=true)

# Getting started
First you need to install the CLI. This requires [Node](https://nodejs.org/en/download/) installed.

`npm i @pruner/cli -g`

## Language & framework support
Pruner supports several languages and frameworks. Pick the instructions for the language you want to use, to get started.
### `dotnet` (C# .NET, VB .NET)
Instructions: https://github.com/pruner/cli/blob/main/docs/dotnet.md

### `mocha` (JavaScript)
Instructions: https://github.com/pruner/cli/blob/main/docs/mocha.md

### Looking for more providers?
File an issue or feel free to submit a pull request!

# Running tests
When you want to run your affected tests, use:

`pruner run`

## Watch mode
There's also a watch mode available, which will automatically run affected tests as you save files in your projects:

`pruner run --watch`

# Comparison with other tools
## As an alternative to NCrunch
NCrunch:
- Does not offer a free version. Pruner is free.
- Has not open-sourced their code. Pruner is fully open source.
- Only runs in Visual Studio. Pruner runs in Visual Studio Code as well, or on your build server.
- Does not remember your test state. Every time you reboot your machine, you have to re-run all tests again. Pruner persists your state to the disk, so that you can resume where you left off.

## As an alternative to WallabyJS
WallabyJS:
- Does not offer a free version (except for Open Source projects). Pruner is free.
- Does not run other languages than JavaScript. Pruner supports several languages, and can combine all your test runs across technologies and frameworks in a single command.
- Does not remember your test state. Every time you reboot your machine, you have to re-run all tests again. Pruner persists your state to the disk, so that you can resume where you left off.
- Does not run on your build server. Pruner runs on your build server, allowing you to save time running tests there as well.

## As an alternative to DotCover
DotCover:
- Does not offer a free version (except for Open Source projects). Pruner is free.
- Does not run other languages than `dotnet` (C#, VB). Pruner supports several languages, and can combine all your test runs across technologies and frameworks in a single command.
- Does not remember your test state. Every time you reboot your machine, you have to re-run all tests again. Pruner persists your state to the disk, so that you can resume where you left off.
- Does not run on your build server. Pruner runs on your build server, allowing you to save time running tests there as well.

# Contributing
To contribute, you need to have the following installed:
- .NET SDK 5 (https://dotnet.microsoft.com/download)
- Global install of the NPM package `mocha` (`npm i mocha -g`)