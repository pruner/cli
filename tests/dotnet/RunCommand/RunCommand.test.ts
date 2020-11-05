jest.setTimeout(1000 * 60 * 5);

import { join } from 'path';
import { handler } from '../../../src/commands/RunCommand';
import _ from 'lodash';
import { State } from '../../../src/providers';
import execa from 'execa';
import rimraf from 'rimraf';
import { copy, pathExists, rmdir } from 'fs-extra';

import git from '../../../src/git';
import io from '../../../src/io';

io.getPrunerPath = async () => "tests/dotnet/RunCommand/temp/.pruner";

let mockCurrentDiff = "";
git.getCurrentDiffText = async () => mockCurrentDiff;

describe("RunCommand", () => {    
    const currentDirectory = join("tests", "dotnet", "RunCommand");

    const cleanup = async () => {
        rimraf.sync(join(currentDirectory, "temp"));
    }

    const lineRange = (from: number, to: number) => _.range(from, to + 1);

    const getState = async (): Promise<State> => {
        const result = await io.readFromFile(join(currentDirectory, "temp", ".pruner", "state.json"));
        if(!result) {
            return {
                coverage: [],
                files: [],
                tests: []
            };
        }

        return JSON.parse(result.toString()) as State;
    }

    const getFileCoverage = async (fileName: string) => {
        const state = await getState();
        const file = state.files.find(x => x.path.endsWith(fileName));
        return state.coverage.filter(x => x.fileId === file.id);
    }

    const getCoveredLineNumbersForFile = async (fileName: string) => {
        const coverage = await getFileCoverage(fileName);
        return coverage.map(x => x.lineNumber);
    }

    const gitDiff = async (path1: string, path2: string) => {
        const result = await execa("git", [
            "diff",
            "--no-index",
            path1,
            path2
        ], {
            reject: false
        });
        return result.stdout;
    }

    const revertCode = async (fileName: string) => {
        const fromPath = join("tests", "dotnet", "sample", "Sample", fileName);
        const toPath = join(currentDirectory, "temp", "Sample", fileName);

        await replaceCodeFiles(fromPath, toPath);
    }

    const overwriteCode = async (fileName: string) => {
        const fromPath = join(currentDirectory, fileName);
        const toPath = join(currentDirectory, "temp", "Sample", `${fileName.substr(0, fileName.indexOf("."))}.cs`);

        await replaceCodeFiles(fromPath, toPath);
    }

    const replaceCodeFiles = async (fromPath: string, toPath: string) => {
        mockCurrentDiff = await gitDiff(
            toPath, 
            fromPath);

        const fromContents = await io.readFromFile(fromPath);

        await io.writeToFile(
            toPath,
            fromContents.toString());
    }

    beforeEach(async () => {
        await cleanup();

        const temporaryFolderPath = join(__dirname, "temp");
        await copy(
            join(__dirname, "..", "sample"),
            temporaryFolderPath);

        const gitignoreContents = await io.readFromFile(join(temporaryFolderPath, ".gitignore"));
        const directoriesToRemove = await Promise.all(_
            .chain(gitignoreContents)
            .split('\n')
            .map(x => io.glob(temporaryFolderPath, x))
            .value());
        const directoriesToRemoveFlat = _.chain(directoriesToRemove)
            .flatMap(x => x)
            .map(x => join(temporaryFolderPath, x))
            .value();
        for(let directory of directoriesToRemoveFlat) {
            if(!await pathExists(directory)) {
                console.debug("not-present", directory);
                continue;
            }

            console.debug("purging", directory);
            rimraf.sync(directory);
        }

        await io.writeToFile(
            join(__dirname, "temp", ".pruner", "settings.json"),
            JSON.stringify({
                dotnet: [{
                    "workingDirectory": "tests/dotnet/RunCommand/temp"
                }]
            }));
    });

    test('run -> check coverage', async () => {
        await handler({
            provider: "dotnet"
        });

        const coverage = await getCoveredLineNumbersForFile("SomeClass.cs");
        expect(coverage).toEqual(lineRange(10, 17));
    });

    test('run -> run -> check coverage', async () => {
        await handler({
            provider: "dotnet"
        });

        await handler({
            provider: "dotnet"
        });

        const coverage = await getCoveredLineNumbersForFile("SomeClass.cs");
        expect(coverage).toEqual(lineRange(10, 17));
    });

    test('run -> change condition -> run -> revert condition -> check coverage', async () => {
        await handler({
            provider: "dotnet"
        });

        await overwriteCode("SomeClass.condition-change.cs");
        await handler({
            provider: "dotnet"
        });

        await revertCode("SomeClass.cs");
        await handler({
            provider: "dotnet"
        });

        const coverage = await getCoveredLineNumbersForFile("SomeClass.cs");
        expect(coverage).toEqual(lineRange(10, 17));
    });

    test('run -> change condition -> run -> check coverage', async () => {
        await handler({
            provider: "dotnet"
        });

        await overwriteCode("SomeClass.condition-change.cs");
        await handler({
            provider: "dotnet"
        });

        const coverage = await getCoveredLineNumbersForFile("SomeClass.cs");
        expect(coverage).toEqual([
            ...lineRange(10, 11),
            ...lineRange(14, 17)
        ]);
    });
});