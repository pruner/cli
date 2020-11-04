jest.setTimeout(1000 * 60 * 5);

jest.mock('../../../src/io/get-pruner-path', () => ({
    ...(jest.requireActual('../../../src/io/get-pruner-path')),
    getPrunerPath: async () => "tests/dotnet/RunCommand/temp/.pruner"
}));

import { join } from 'path';
import * as rimraf from 'rimraf';
import {copy} from 'fs-extra';
import { handler } from '../../../src/commands/RunCommand';
import _ from 'lodash';
import { readFromFile, writeToFile } from '../../../src/io';
import { State } from '../../../src/providers';

const gitDiff = require('git-diff')

describe("RunCommand", () => {
    const cleanup = async () => {
        rimraf.sync(join(__dirname, "temp"));
    }

    const lineRange = (from: number, to: number) => _.range(from, to + 1);

    const getState = async (): Promise<State> => {
        const result = await readFromFile(join(__dirname, "temp", ".pruner", "state.json"));
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

    let mockCurrentDiff: string;
    const overwriteCode = async (fileName: string) => {
        const templateFileContents = await readFromFile(join(__dirname, fileName));
        const templateFileName = `${fileName.substr(0, fileName.indexOf("."))}.cs`;
        
        const existingFilePath = join(__dirname, "temp", "Sample", templateFileName);
        const existingFileContents = await readFromFile(existingFilePath);

        mockCurrentDiff = gitDiff(existingFileContents, templateFileContents);

        await writeToFile(
            existingFilePath,
            templateFileContents.toString());
    }

    jest.mock('../../../src/git', () => ({
        ...(jest.requireActual('../../../src/git')),
        getCurrentDiffText: async () => mockCurrentDiff
    }));

    beforeEach(async () => {
        await cleanup();

        await copy(
            join(__dirname, "..", "sample"),
            join(__dirname, "temp"));

        await writeToFile(
            join(__dirname, "temp", ".pruner", "settings.json"),
            JSON.stringify({
                dotnet: [{
                    "workingDirectory": "tests/dotnet/RunCommand/temp"
                }]
            }));
    });

    // test('run -> check coverage', async () => {
    //     await overwriteCode("SomeClass.1.cs");

    //     await handler({
    //         provider: "dotnet"
    //     });

    //     const coverage = await getCoveredLineNumbersForFile("SomeClass.cs");
    //     expect(coverage).toEqual(lineRange(10, 17));
    // });

    // test('run -> run -> check coverage', async () => {
    //     await overwriteCode("SomeClass.1.cs");

    //     await handler({
    //         provider: "dotnet"
    //     });

    //     await handler({
    //         provider: "dotnet"
    //     });

    //     const coverage = await getCoveredLineNumbersForFile("SomeClass.cs");
    //     expect(coverage).toEqual(lineRange(10, 17));
    // });

    test('run -> change condition -> run -> check coverage', async () => {
        await overwriteCode("SomeClass.1.cs");
        await handler({
            provider: "dotnet"
        });

        await overwriteCode("SomeClass.2.cs");
        await handler({
            provider: "dotnet"
        });

        const coverage = await getCoveredLineNumbersForFile("SomeClass.cs");
        expect(coverage).toEqual([
            ...lineRange(10, 11),
            ...lineRange(13, 17)
        ]);
    });
});