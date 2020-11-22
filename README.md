# What is this?
The Pruner CLI is a wrapper around your default way of running tests, to only run the tests that have been affected by your GIT pending changes, to significantly boost performance.

# Coverage Gutters for Visual Studio Code
It also works well with the [Coverage Gutters](https://marketplace.visualstudio.com/items?itemName=ryanluker.vscode-coverage-gutters) Visual Studio Code extension, by live providing `lcov.info` files that it can pick up, to see coverage as it changes.

# Getting started
Pruner supports multiple languages.

You always need the CLI installed though.

`npm i @pruner/cli -g`

## `dotnet` (C# .NET, VB .NET)
To use Pruner, you must install the `AltCover` [NuGet package](https://www.nuget.org/packages/altcover/) to all your test projects.

`Install-Package AltCover`

Then, to set up everything, you simply run:

`pruner init dotnet`

And the setup wizard will take you through the steps to get started.

When you want to run your tests, use:

`pruner run`

There's also a watch mode available:

`pruner run --watch`

# Contributing
To contribute, you need to have the following installed:
- .NET SDK 5