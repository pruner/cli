import { chain, flatMap, last, remove } from 'lodash';
import { green, red, white, yellow } from 'chalk';
import { join } from 'path';
import chokidar from 'chokidar';
import { Command, DefaultArgs } from './Command';
import con from '../console';
import git, { FileChanges } from '../git';
import io from '../io';
import { allProviders, Provider, State, ProviderClass, LineCoverage, Settings, Test } from '../providers';

type Args = DefaultArgs & {
	provider?: string;
	watch?: boolean;
};

type RunReport = {
	testsRun: Test[];
	mergedState: State;
};

export default {
	command:
		'run [provider]',
	describe:
		'Run tests.',
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

	const providers = await createProvidersFromArguments(args);
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

async function createProvidersFromArguments(args: Args) {
	const classes = args.provider ?
		[allProviders.find(x => x.providerName === args.provider)] :
		allProviders;

	const providers = await Promise.all(classes.map(createProvidersFromClass));
	return flatMap(
		providers,
		providers => providers,
	);
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
		mergedState: await mergeState(
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

async function persistState(state: State) {
	const stateFileName = getStateFileName();
	await io.writeToPrunerFile(
		stateFileName,
		JSON.stringify(
			state,
			null,
			' '));
}

async function readState(): Promise<State> {
	const stateFileName = getStateFileName();
	return JSON.parse(
		await io.readFromPrunerFile(stateFileName));
}

function getStateFileName() {
	return `state.json`;
}

async function generateLcovFile(state?: State) {
	let lcovContents = '';

	function appendLine(
		line: string,
	) {
		lcovContents += `${line}\n`;
	}

	const rootDirectory = await git.getGitTopDirectory();

	if (state) {
		for (const file of state.files) {
			const fullPath = join(
				rootDirectory,
				file.path,
			);
			appendLine(
				`SF:${fullPath}`,
			);

			const lines = state.coverage.filter(
				x => x.fileId
					=== file.id,
			);
			for (const line of lines) {
				const isCovered = line
					.testIds
					.length
					> 0;
				appendLine(
					`DA:${line.lineNumber
					},${isCovered
						? 1
						: 0
					}`,
				);
			}

			appendLine(
				'end_of_record',
			);
		}
	}

	await io.writeToPrunerFile(
		join(
			'temp',
			'lcov.info',
		),
		lcovContents,
	);
}

async function createProvidersFromClass(
	Provider: ProviderClass<
		Settings
	>,
) {
	const settings = JSON.parse(
		await io.readFromPrunerFile(
			'settings.json',
		),
	);
	const providerSettings = settings[
		Provider
			.providerName
	] as Settings[];

	return providerSettings.map(
		settings => new Provider(
			settings,
		),
	);
}

async function mergeState(
	testsInFilter: Test[],
	previousState: State,
	newState: State,
): Promise<
	State
> {
	const allNewTestIds = chain(newState.coverage)
		.flatMap(x => x.testIds)
		.uniq()
		.value();

	const linesToRemove: LineCoverage[] = [];
	if (
		previousState
	) {
		for (const previousLine of previousState.coverage) {
			if (
				previousLine
					.testIds
					.length
				=== 0
			)
				continue;

			const newLine = newState.coverage.find(
				x => x.lineNumber
					=== previousLine.lineNumber
					&& x.fileId
					=== previousLine.fileId,
			);
			if (
				newLine
			)
				continue;

			let remove = false;

			const previousTestIds = previousLine.testIds;

			for (const previousTestId of previousTestIds) {
				const existsInNewTests = !!allNewTestIds.find(
					newTestId => newTestId
						=== previousTestId,
				);
				if (
					existsInNewTests
				)
					remove = true;
			}

			if (
				remove
			) {
				linesToRemove.push(
					previousLine,
				);
			}
		}
	}

	const mergedState: State = {
		commitId:
			newState?.commitId
			|| previousState?.commitId,
		tests: chain(
			[
				previousState?.tests
				|| [],
				newState.tests
				|| [],
			],
		)
			.flatMap()
			.uniqBy(
				x => x.name,
			)
			.value(),
		files: chain(
			[
				previousState?.files
				|| [],
				newState.files
				|| [],
			],
		)
			.flatMap()
			.uniqBy(
				x => x.path,
			)
			.value(),
		coverage: chain(
			[
				previousState?.coverage
				|| [],
				newState.coverage,
			],
		)
			.flatMap()
			.filter(
				x => !linesToRemove.find(
					l => l.fileId
						=== x.fileId
						&& l.lineNumber
						=== x.lineNumber,
				),
			)
			.uniqBy(
				x => `${x.fileId}-${x.lineNumber}`,
			)
			.value()
	};

	for (const testInFilter of testsInFilter) {
		const newStateTestIndex = newState.tests.findIndex(
			x => x.name
				=== testInFilter.name,
		);
		const mergedStateTestIndex = mergedState.tests.findIndex(
			x => x.name
				=== testInFilter.name,
		);
		if (
			newStateTestIndex
			=== -1
			&& mergedStateTestIndex
			> -1
		) {
			mergedState.tests.splice(
				mergedStateTestIndex,
				1,
			);

			mergedState.coverage.forEach(
				lineCoverage => remove(
					lineCoverage.testIds,
					x => x
						=== testInFilter.id,
				),
			);
		}
	}

	remove(
		mergedState.coverage,
		x => x
			.testIds
			.length
			=== 0,
	);

	return mergedState;
}

async function getTestsToRun(
	previousState: State,
	newCommitId: string,
) {
	if (!previousState) {
		return {
			affected: new Array<Test>(),
			unaffected: new Array<Test>()
		};
	}

	const gitChangedFiles = await git.getChangedFiles(
		previousState.commitId,
		newCommitId,
	);
	const affectedTests = getAffectedTests(
		gitChangedFiles,
		previousState,
	);

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

function getNewLineNumberForLineCoverage(gitChangedFile: FileChanges, gitLineCoverage: LineCoverage) {
	const gitUnchangedLine = gitChangedFile.unchanged
		.find(x => x.oldLineNumber === gitLineCoverage.lineNumber);

	const newLineNumber = gitUnchangedLine?.newLineNumber ||
		gitLineCoverage.lineNumber;
	return newLineNumber;
}

function getTestFromStateById(state: State, id: number): Test {
	return state.tests.find(y => y.id === id);
}

/**
 * This function exists in case we have removed a line,
 * and therefore don't have coverage data on that line anymore,
 * so we check nearby surrounding instead.
 */
function hasCoverageOfLineInSurroundingLines(
	line: number,
	allLines: number[],
) {
	return (
		allLines.indexOf(line - 1) > -1 ||
		allLines.indexOf(line) > -1 ||
		allLines.indexOf(line + 1) > -1
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
	const file = state.files.find(
		x => x.path
			=== path,
	);
	if (
		!file
	)
		return null;

	return file.id;
}
