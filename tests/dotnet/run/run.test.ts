jest.setTimeout(1000 * 60 * 5);

import { basename, dirname, join } from 'path';
import { handler } from '../../../src/commands/run/RunCommand';
import _, { last } from 'lodash';
import rimraf from 'rimraf';
import { copy, pathExists } from 'fs-extra';

import git from '../../../src/git';
import io from '../../../src/io';
import pruner from '../../../src/pruner';
import { gitDiff } from '../../helpers/git';
import { ProviderState } from '../../../src/providers/types';

pruner.getPrunerPath = async () => "tests/dotnet/run/temp/.pruner";

let mockCurrentDiff = "";
git.getCurrentDiffText = async () => mockCurrentDiff;

describe("run", () => {
	const currentDirectory = join("tests", "dotnet", "run");

	const cleanup = async () => {
		rimraf.sync(join(currentDirectory, "temp"));
	}

	const lineRange = (from: number, to: number) => _.range(from, to + 1);

	const getState = async (): Promise<ProviderState> => {
		const result = await io.readFromFile(join(currentDirectory, "temp", ".pruner", "state", "tests.json"));
		if (!result) {
			return {
				coverage: [],
				files: [],
				tests: []
			};
		}

		const states = JSON.parse(result.toString());
		return states;
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
		if (!fromContents)
			throw new Error("Could not find: " + fromPath);

		await io.writeToFile(
			toPath,
			fromContents.toString());
	}

	const runHandler = async () => {
		return await handler({
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
				providers: [{
					"id": "tests",
					"type": "dotnet",
					"workingDirectory": "tests/dotnet/run/temp"
				}]
			}));
	});

	test('run -> check coverage', async () => {
		const testRun = await runHandler();
		expect(testRun.length).toBe(12);

		const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
		expect(coverage).toEqual([
			...lineRange(10, 20),
			...lineRange(22, 31),
			33
		]);
	});

	test('run -> run -> check coverage', async () => {
		const testRun1 = await runHandler();
		expect(testRun1.length).toBe(12);

		const testRun2 = await runHandler();
		expect(testRun2.length).toBe(0);

		const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
		expect(coverage).toEqual([
			...lineRange(10, 20),
			...lineRange(22, 31),
			33
		]);
	});

	test('run -> change condition -> run -> revert condition -> check coverage', async () => {
		const testRun1 = await runHandler();
		expect(testRun1.length).toBe(12);

		await overwriteCode("Sample/SomeClass.condition-change.cs");
		const testRun2 = await runHandler();
		expect(testRun2.length).toBe(12);

		await revertCode("Sample/SomeClass.cs");
		const testRun3 = await runHandler();
		expect(testRun3.length).toBe(12);

		const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
		expect(coverage).toEqual([
			...lineRange(10, 20),
			...lineRange(22, 31),
			33
		]);
	});

	test('run -> change condition -> run -> check coverage', async () => {
		const testRun1 = await runHandler();
		expect(testRun1.length).toBe(12);

		await overwriteCode("Sample/SomeClass.condition-change.cs");
		const testRun2 = await runHandler();
		expect(testRun2.length).toBe(12);

		const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
		expect(coverage).toEqual([
			...lineRange(10, 11),
			...lineRange(22, 31),
			33
		]);
	});

	test('run -> comment out test -> run -> check coverage', async () => {
		const testRun1 = await runHandler();
		expect(testRun1.length).toBe(12);

		await overwriteCode("Sample.Tests/SampleDarknessTests.commented.cs");
		const testRun2 = await runHandler();
		expect(testRun2.length).toBe(0);

		const coverageForTest = await getCoveredLineNumbersForFile("Sample.Tests/SampleDarknessTests.cs");
		expect(coverageForTest).toEqual([]);

		const coverageForClass = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
		expect(coverageForClass).toEqual([
			...lineRange(10, 20),
			33
		]);
	});

	test('run -> make change in first if-branch -> run -> check coverage', async () => {
		const testRun1 = await runHandler();
		expect(testRun1.length).toBe(12);

		await overwriteCode("Sample/SomeClass.first-branch-change.cs");
		const testRun2 = await runHandler();
		expect(testRun2.length).toBe(6);

		const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
		expect(coverage).toEqual([
			...lineRange(10, 20),
			...lineRange(22, 31),
			33
		]);
	});

	test('run -> make darkness tests fail -> run -> check coverage', async () => {
		const testRun1 = await runHandler();
		expect(testRun1.length).toBe(12);

		await overwriteCode("Sample/SomeClass.darkness-test-fail.cs");
		const testRun2 = await runHandler();
		expect(testRun2.length).toBe(12);

		const coverage = await getCoveredLineNumbersForFile("Sample/SomeClass.cs");
		expect(coverage).toEqual([
			...lineRange(10, 11),
			...lineRange(22, 31),
			33
		]);
	});
});