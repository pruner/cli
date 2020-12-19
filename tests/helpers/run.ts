import { basename, dirname, join } from 'path';
import { handler } from '../../src/commands/run/RunCommand';
import _ from 'lodash';
import { copy, copyFile, existsSync } from 'fs-extra';

import git from '../../src/git';
import io from '../../src/io';
import pruner from '../../src/pruner';
import { gitDiff } from './git';
import { ProviderType, ProviderState } from '../../src/providers/types';
import rimraf from 'rimraf';

export function prepareRunTest(
	providerType: ProviderType,
	directory: string,
	onBeforeEach?: (sampleOriginDirectoryPath: string) => Promise<void>
) {
	pruner.getPrunerPath = async () => `tests/${directory}/run/temp/.pruner`;

	let mockCurrentDiff = "";
	git.getCurrentDiffText = async () => mockCurrentDiff;

	const currentDirectory = join("tests", directory, "run");
	const stateDirectory = join(currentDirectory, "temp", ".pruner", "state");
	const temporaryFolderPath = join(currentDirectory, "temp");

	const passedLineRange = (from: number, to?: number) =>
		_.range(from, (to || from) + 1);

	const failedLineRange = (from: number, to?: number) =>
		passedLineRange(from, to).map(x => -x);

	const getState = async (): Promise<ProviderState> => {
		const result = await io.readFromFile(join(stateDirectory, "tests.json"));
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

	const getCoveredLineNumbersForFile = async (fileName: string) => {
		const state = await getState();

		const file = state.files.find(x => x.path.endsWith(fileName));
		if (!file)
			throw new Error("File not covered.");

		return _.chain(state.coverage)
			.filter(x => x.fileId === file.id)
			.map(x => ({
				...x,
				tests: x.testIds.map(testId => state
					.tests
					.find(t => t.id === testId))
			}))
			.map(x => x.tests.find(y => !!y.failure) ?
				-x.lineNumber :
				x.lineNumber)
			.orderBy(Math.abs)
			.value();
	}

	const revertCode = async (fileName: string) => {
		const fromPath = join("tests", directory, "sample", fileName);
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
		const result = await handler({
			provider: providerType,
			verbosity: "normal"
		});

		const stateJsonFilePath = join(stateDirectory, "tests.json");
		if (existsSync(stateJsonFilePath)) {
			await copyFile(
				stateJsonFilePath,
				join(stateDirectory, "tests.previous.json"));
		}

		return result;
	}

	const context = {
		runHandler,
		getCoveredLineNumbersForFile,
		revertCode,
		overwriteCode,
		passedLineRange,
		failedLineRange,
		currentDirectory
	};

	beforeEach(async () => {
		rimraf.sync(join(currentDirectory, "temp"));

		const sampleOriginDirectoryPath = join(currentDirectory, "..", "sample");
		onBeforeEach && await onBeforeEach(sampleOriginDirectoryPath);

		await copy(
			sampleOriginDirectoryPath,
			temporaryFolderPath);

		await io.writeToFile(
			join(currentDirectory, "temp", ".pruner", "settings.json"),
			JSON.stringify({
				providers: [{
					"id": "tests",
					"type": providerType,
					"workingDirectory": `tests/${directory}/run/temp`
				}]
			}));
	});

	return context;
}