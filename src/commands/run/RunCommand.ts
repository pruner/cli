import { chain, flatMap, uniqBy } from 'lodash';
import { green, red, white, yellow } from 'chalk';
import { Command, DefaultArgs } from '../Command';
import con from '../../console';
import git, { CommitRange, FileChanges } from '../../git';
import chokidar from 'chokidar';
import pruner from '../../pruner';
import _ from 'lodash';
import { allProviderClasses, createProvidersFromProvider as createProvidersFromIdOrNameOrType } from '../../providers/factories';
import { StateTest, ProviderState, Provider, StateLineCoverage } from '../../providers/types';
import { mergeStates } from './state';
import { generateLcovFile } from './lcov';
import { join } from 'path';

type Args = DefaultArgs & {
	provider?: string;
	watch?: boolean;
};

type RunReport = {
	testsRun: StateTest[];
	mergedState: ProviderState;
};

export default {
	command: 'run [provider]',
	describe: 'Run tests.',
	builder: yargs => yargs
		.positional('provider', {
			choices: allProviderClasses.map(x => x.providerType),
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

	const prunerDirectory = await pruner.getPrunerPath();
	if (!prunerDirectory) {
		console.error(red('Pruner has not been initialized for this project.'));
		console.log(`Run ${white('pruner init')}.`);
		return;
	}

	const providers = await createProvidersFromIdOrNameOrType(args.provider);
	const stateChanges = await runTestsForProviders(providers);

	if (args.watch) {
		for (const provider of providers)
			watchProvider(provider);
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
		return await runInGitStateTransaction(async commitRange =>
			await runTestsForProvider(
				provider,
				commitRange));
	};

	const onFilesChanged = async () => {
		if (isRunning) {
			hasPending = true;
			return;
		}

		isRunning = true;

		try {
			const results = new Array<StateTest>();
			results.push(...await runTests());

			while (hasPending) {
				hasPending = false;
				results.push(...await runTests());
			}

			console.log(white('Waiting for file changes...'));

			return uniqBy(results, x => x.id);
		} finally {
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
		watcher.on('change', onFilesChanged);
		watcher.on('add', onFilesChanged);
		watcher.on('unlink', onFilesChanged);
		watcher.on('addDir', onFilesChanged);
		watcher.on('unlinkDir', onFilesChanged);
	});
}

async function runInGitStateTransaction<T>(action: (commitRange: CommitRange) => Promise<T>) {
	const gitState = await pruner.readGitState();

	const commitRange: CommitRange = {
		from: gitState.commit,
		to: await git.createStashCommit()
	};

	const results = await action(commitRange);
	await pruner.persistGitState(commitRange.to);

	return results;
}

async function runTestsForProviders(providers: Provider[]) {
	const results = await runInGitStateTransaction(async commitRange =>
		await Promise.all(providers
			.map(async provider =>
				await runTestsForProvider(
					provider,
					commitRange))));
	return flatMap(results);
}

async function runTestsForProvider(
	provider: Provider,
	commitRange: CommitRange
) {
	const providerId = provider.settings.id;
	await generateLcovFile(providerId);

	const previousState = await pruner.readState(providerId);

	const testsToRun = await getTestsToRun(
		previousState,
		commitRange);

	const processResult = await con.useSpinner(
		'Running tests',
		async () => await provider.executeTestProcess(testsToRun));

	if (processResult.exitCode !== 0) {
		console.error(`${red(`Could not run tests. Exit code ${processResult.exitCode}.`)}\n${yellow(processResult.stdout)}\n${red(processResult.stderr)}`);
	} else {
		console.log(green('Tests ran successfully:'));
		console.log(white(processResult.stdout));
	}

	const state = await provider.gatherState() || {
		coverage: [],
		files: [],
		tests: []
	};

	const mergedState = await mergeStates(
		testsToRun.affected,
		previousState,
		state
	);
	await pruner.persistState(providerId, mergedState);
	await generateLcovFile(providerId, mergedState);

	const actualTestRuns = chain(state.coverage)
		.flatMap(x => x.testIds)
		.uniq()
		.map(x => state
			.tests
			.find(y => y.id === x))
		.value();
	return actualTestRuns;
}

async function getTestsToRun(
	previousState: ProviderState,
	commitRange: CommitRange
) {
	if (!previousState) {
		return {
			affected: new Array<StateTest>(),
			unaffected: new Array<StateTest>()
		};
	}

	const gitChangedFiles = await git.getChangedFiles(commitRange);
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
	previousState: ProviderState,
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

function getTestFromStateById(state: ProviderState, id: number): StateTest {
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
	previousState: ProviderState,
	gitChangedFile: FileChanges,
) {
	const fileIdForGitChange = getFileIdFromStateForPath(
		previousState,
		gitChangedFile.filePath);

	return getLineCoverageForFileFromState(
		previousState,
		fileIdForGitChange);
}

function getLineCoverageForFileFromState(state: ProviderState, fileId: number) {
	return state.coverage.filter(
		previousStateLine => previousStateLine.fileId === fileId);
}

function getFileIdFromStateForPath(
	state: ProviderState,
	path: string,
) {
	const file = state.files.find(x => x.path === path);
	if (!file)
		return null;

	return file.id;
}
