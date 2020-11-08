import { chain, flatMap, last, remove } from 'lodash';
import { green, red, white, yellow } from 'chalk';
import { join } from 'path';
import chokidar from 'chokidar';
import { Command, DefaultArgs } from '../Command';
import con from '../../console';
import git, { FileChanges } from '../../git';
import io from '../../io';
import _ from 'lodash';
import { allProviders, createProvidersFromArguments } from '../../providers/factories';
import { StateTest, State, Provider, ProviderClass, ProviderSettings, StateLineCoverage } from '../../providers/types';
import { mergeState as mergeStates, persistState, readState } from './state';
import { generateLcovFile } from './lcov';

type Args = DefaultArgs & {
	provider?: string;
	watch?: boolean;
};

type RunReport = {
	testsRun: StateTest[];
	mergedState: State;
};

export default {
	command: 'run [provider]',
	describe: 'Run tests.',
	builder: yargs => yargs
		.positional('provider', {
			choices: allProviders.map(x => x.providerName),
			demandOption: false,
			type: 'string',
			describe: 'The provider to run tests for. If not specified, runs all tests.'
		})
		.option('watch', {
			alias: 'w',
			type: 'boolean',
			demandOption: false,
			describe: 'Launches in watch mode (run tests as files change).'
		}),
	handler
} as Command<Args>;

export async function handler(args: Args) {
	if (args.verbosity !== 'verbose')
		console.debug = () => { };

	const prunerDirectory = await io.getPrunerPath();
	if (!prunerDirectory) {
		console.error(red('Pruner has not been initialized for this project.'));
		console.log(`Run ${white('pruner init')}.`);
		return;
	}

	const providers = await createProvidersFromArguments(args.provider);
	const stateChanges = await runTestsForProviders(providers);

	if (args.watch) {
		for (const provider of providers)
			watchProvider(provider);
	}

	return stateChanges;
}

async function withStateMiddleware(
	action: (previousState: State, newCommitId: string) => Promise<RunReport[]>
) {
	await generateLcovFile();

	const newCommitId = await git.createStashCommit();

	let state = await readState();

	const stateChanges = await action(
		state,
		newCommitId);
	if (stateChanges?.length > 0) {
		state = last(stateChanges).mergedState;

		state.commitId = newCommitId;

		await persistState(state);
		await generateLcovFile(state);
	}

	return stateChanges;
}

function watchProvider(provider: Provider) {
	if (provider.settings.excludeFromWatch) {
		console.log(yellow("A provider was excluded from watch due to the 'excludeFromWatch' setting."));
		return;
	}

	let isRunning = false;
	let hasPending = false;

	const runTests = async () => {
		if (isRunning) {
			hasPending = true;
			return;
		}

		isRunning = true;

		try {
			await withStateMiddleware(async (state, newCommitId) => {
				let stateChange = await runTestsForProvider(
					provider,
					state,
					newCommitId);

				while (hasPending) {
					hasPending = false;
					stateChange = await runTestsForProvider(
						provider,
						state,
						newCommitId);
				}

				return [stateChange];
			});
		} finally {
			console.log(white('Waiting for file changes...'));
			isRunning = false;
		}
	};

	const paths = provider
		.getGlobPatterns()
		.map(x => join(provider.settings.workingDirectory, x));

	const watcher = chokidar.watch(paths, {
		atomic: 1000,
		ignorePermissionErrors: true,
		useFsEvents: true,
		persistent: true
	});
	watcher.on('ready', () => {
		watcher.on('change', runTests);
		watcher.on('add', runTests);
		watcher.on('unlink', runTests);
		watcher.on('addDir', runTests);
		watcher.on('unlinkDir', runTests);
	});
}

async function runTestsForProviders(providers: Provider[]) {
	return await withStateMiddleware(async (state, newCommitId) => {
		const newStates = new Array<RunReport>();
		for (const provider of providers) {
			const stateChange = await runTestsForProvider(
				provider,
				state,
				newCommitId);
			if (!stateChange)
				continue;

			state = stateChange.mergedState;

			newStates.push(stateChange);
		}

		return newStates;
	});
}

async function runTestsForProvider(
	provider: Provider,
	previousState: State,
	newCommitId: string
): Promise<RunReport> {
	const testsToRun = await getTestsToRun(
		previousState,
		newCommitId);

	const result = await con.useSpinner(
		'Running tests',
		async () => await provider.executeTestProcess(testsToRun));

	if (result.exitCode !== 0) {
		console.error(`${red(`Could not run tests. Exit code ${result.exitCode}.`)}\n${yellow(result.stdout)}\n${red(result.stderr)}`);
		return;
	}

	console.log(green('Tests ran successfully:'));
	console.log(white(result.stdout));

	const state = await provider.gatherState();

	return {
		mergedState: await mergeStates(
			testsToRun.affected,
			previousState,
			state,
		),
		testsRun: chain(state.coverage)
			.flatMap(x => x.testIds)
			.uniq()
			.map(x => state
				.tests
				.find(y => y.id === x))
			.value()
	};
}

async function getTestsToRun(
	previousState: State,
	newCommitId: string,
) {
	if (!previousState) {
		return {
			affected: new Array<StateTest>(),
			unaffected: new Array<StateTest>()
		};
	}

	const gitChangedFiles = await git.getChangedFiles(
		previousState.commitId,
		newCommitId);
	const affectedTests = getAffectedTests(
		gitChangedFiles,
		previousState);

	const allKnownUnaffectedTests = previousState.tests
		.filter(x => !affectedTests.find(y => y.id === x.id));

	return {
		affected: affectedTests,
		unaffected: allKnownUnaffectedTests
	};
}

function getAffectedTests(
	gitFileChanges: FileChanges[],
	previousState: State,
) {
	const correctedLineCoverage = flatMap(
		gitFileChanges,
		gitChangedFile => getLineCoverageForGitChangedFile(previousState, gitChangedFile)
			.filter(gitLineCoverage => {
				const newLineNumber = getNewLineNumberForLineCoverage(
					gitChangedFile,
					gitLineCoverage);

				return (
					hasCoverageOfLineInSurroundingLines(newLineNumber, gitChangedFile.added) ||
					hasCoverageOfLineInSurroundingLines(newLineNumber, gitChangedFile.deleted)
				);
			}));

	return chain(correctedLineCoverage)
		.flatMap(lineCoverage => lineCoverage.testIds)
		.map(testId => getTestFromStateById(previousState, testId))
		.uniqBy(test => test.name)
		.value();
}

function getNewLineNumberForLineCoverage(gitChangedFile: FileChanges, gitLineCoverage: StateLineCoverage) {
	const gitUnchangedLine = gitChangedFile.unchanged
		.find(x => x.oldLineNumber === gitLineCoverage.lineNumber);

	const newLineNumber = gitUnchangedLine?.newLineNumber ||
		gitLineCoverage.lineNumber;
	return newLineNumber;
}

function getTestFromStateById(state: State, id: number): StateTest {
	return state.tests.find(y => y.id === id);
}

/**
 * This function exists in case we have added a new line,
 * and therefore don't have coverage data on that line,
 * so we check nearby surrounding lines instead.
 */
function hasCoverageOfLineInSurroundingLines(
	line: number,
	allLines: number[],
) {
	return (
		allLines.indexOf(line - 1) > -1 ||
		allLines.indexOf(line) > -1
	);
}

function getLineCoverageForGitChangedFile(
	previousState: State,
	gitChangedFile: FileChanges,
) {
	const fileIdForGitChange = getFileIdFromStateForPath(
		previousState,
		gitChangedFile.filePath);

	return getLineCoverageForFileFromState(
		previousState,
		fileIdForGitChange);
}

function getLineCoverageForFileFromState(state: State, fileId: number) {
	return state.coverage.filter(
		previousStateLine => previousStateLine.fileId === fileId);
}

function getFileIdFromStateForPath(
	state: State,
	path: string,
) {
	const file = state.files.find(x => x.path === path);
	if (!file)
		return null;

	return file.id;
}
