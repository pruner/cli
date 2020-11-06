jest.setTimeout(1000 * 60 * 5);

import { basename, dirname, join } from 'path';
import { handler } from '../../../src/commands/RunCommand';
import _ from 'lodash';
import { State } from '../../../src/providers';
import rimraf from 'rimraf';
import { copy, pathExists } from 'fs-extra';

import git from '../../../src/git';
import io from '../../../src/io';
import { gitDiff } from '../../helpers/git';

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
        if (!result) {
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
        return _.chain(state.coverage)
            .filter(x => x.fileId === file.id)
            .orderBy(x => x.lineNumber)
            .value();
    }

    const getCoveredLineNumbersForFile = async (fileName: string) => {
        const coverage = await getFileCoverage(fileName);
        return coverage.map(x => x.lineNumber);
    }

    const revertCode = async (fileName: string) => {
        const fromPath = join("tests", "dotnet", "sample", fileName);
        const toPath = join(currentDirectory, "temp", fileName);

        await replaceCodeFiles(fromPath, toPath);
    }

    const overwriteCode = async (filePath: string) => {
        const fromPath = join(currentDirectory, filePath);

        const fileName = basename(filePath);
        const toPath = join(currentDirectory, "temp", dirname(filePath), `${fileName.substr(0, fileName.indexOf("."))}.cs`);

        await replaceCodeFiles(fromPath, toPath);
    }

    const replaceCodeFiles = async (fromPath: string, toPath: string) => {
        mockCurrentDiff = await gitDiff(
            toPath,
            fromPath);

        const addExtraBackslashes = (text: string) => text.replace(/\\/g, "\\\\");
        while (mockCurrentDiff.indexOf(addExtraBackslashes(fromPath)) > -1) {
            mockCurrentDiff = mockCurrentDiff.replace(
                addExtraBackslashes(fromPath),
                addExtraBackslashes(toPath));
        }

        const fromContents = await io.readFromFile(fromPath);

        await io.writeToFile(
            toPath,
            fromContents.toString());
    }

    const runHandler = async () => {
        await handler({
            provider: "dotnet",
            verbosity: "verbose"
        });
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
        for (let directory of directoriesToRemoveFlat) {
            if (!await pathExists(directory)) {
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

    // test('run -> check coverage', async () => {
    //     await runHandler();

    //     const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
    //     expect(coverage).toEqual(lineRange(10, 31));
    // });

    // test('run -> run -> check coverage', async () => {
    //     await runHandler();
    //     await runHandler();

    //     const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
    //     expect(coverage).toEqual(lineRange(10, 31));
    // });

    // test('run -> change condition -> run -> revert condition -> check coverage', async () => {
    //     await runHandler();

    //     await overwriteCode("Sample/SomeClass.condition-change.cs");
    //     await runHandler();

    //     await revertCode("Sample/SomeClass.cs");
    //     await runHandler();

    //     const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
    //     expect(coverage).toEqual(lineRange(10, 31));
    // });

    // test('run -> change condition -> run -> check coverage', async () => {
    //     await runHandler();

    //     await overwriteCode("Sample/SomeClass.condition-change.cs");
    //     await runHandler();

    //     const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
    //     expect(coverage).toEqual([
    //         ...lineRange(10, 11),
    //         ...lineRange(21, 31)
    //     ]);
    // });

    test('run -> comment out test -> run -> check coverage', async () => {
        await runHandler();
        
        await overwriteCode("Sample.Tests/SampleDarknessTests.commented.cs");
        await runHandler();

        const coverageForClass = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
        expect(coverageForClass).toEqual([
            ...lineRange(10, 19),
            ...lineRange(31, 31)
        ]);

        const coverageForTest = await getCoveredLineNumbersForFile("Sample.Tests/SampleDarknessTests.cs");
        expect(coverageForTest).toEqual([
            ...lineRange(10, 20)
        ]);
    });
});