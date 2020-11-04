import { join } from 'path';
import * as rimraf from 'rimraf';
import {copy} from 'fs-extra';
import { readFromFile, writeToFile, getPrunerPath } from '../../../src/io';
import { handler } from '../../../src/commands/RunCommand';
import { State } from '../../../src/providers';
import _ from 'lodash';

jest.setTimeout(1000 * 60 * 5);

describe("RunCommand", () => {
    const cleanup = async () => {
        rimraf.sync(join(__dirname, "temp"));
    }

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

    jest.mock('../../../src/io', () => ({
        getPrunerPath: async () => "tests/dotnet/RunCommand/temp/.pruner"
    }));

    beforeEach(async () => {
        await cleanup();

        await copy(
            join(__dirname, "..", "sample"),
            join(__dirname, "temp"));

        await writeToFile(
            join(__dirname, "temp", ".pruner", "settings.json"),
            JSON.stringify({
                dotnet: {
                    "workingDirectory": "tests/dotnet/RunCommand/temp"
                }
            }));
    });

    // afterEach(cleanup);

    const overwriteCode = async (fileName: string) => {
        const fileContents = await readFromFile(
            join(__dirname, fileName));

        const templateFileName = `${fileName.substr(0, fileName.indexOf("."))}.cs`;
        await writeToFile(
            join(__dirname, "temp", "Sample", templateFileName),
            fileContents.toString());
    }

    test('run -> check coverage', async () => {
        expect(await getPrunerPath()).toBe("tests/dotnet/RunCommand/temp/.pruner")

        await overwriteCode("SomeClass.1.cs");
        await handler({
            provider: "dotnet"
        });

        const coverage = await getCoveredLineNumbersForFile("SomeClass.cs");
        expect(coverage).toEqual(_.range(10, 17));
    });
});