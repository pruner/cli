import { flatMap, chain, takeRight, orderBy } from "lodash";
import { CommitRange, FileChanges } from "../../git";
import { ProviderState, StateTest } from "../../providers/types";
import { getTestFromStateById } from "./state";

import { red, gray, bgGreen, bgRed, white, bgGray, yellow } from "chalk";
import { Provider } from "../../providers/types";
import { mergeStates } from "./state";

import git from '../../git';
import pruner from '../../pruner';
import con from '../../console';
import { getLineCoverageForGitChangedFile, getNewLineNumberForLineCoverage, hasCoverageOfLineInSurroundingLines } from "./changes";
import rimraf from "rimraf";
import minimatch from "minimatch";

import type { Args } from './RunCommand';

export async function runTestsForProviders(providers: Provider[], args: Args) {
	const results = await runTestsInGitStateTransaction(providers, args);
	return flatMap(results);
}

async function runTestsForProvider(
	provider: Provider,
	commitRange: CommitRange,
	args: Args
) {
	const providerId = provider.settings.id;

	let previousState: ProviderState;
	try {
		previousState = await pruner.readState(providerId);
	} catch (e) {
		//may happen if GIT is in the middle of a merge for the state file.
		return null;
	}

	sanitizeState(previousState);

	const testsToRun = await getTestsToRun(
		provider.getGlobPatterns(),
		args.all ? null : previousState,
		commitRange);

	const processResult = await con.useSpinner(
		'Running tests',
		async () => await provider.executeTestProcess(testsToRun));

	const newState = await provider.gatherState() || {
		coverage: [],
		files: [],
		tests: []
	};
	sanitizeState(newState);

	const mergedState = await mergeStates(
		testsToRun.affected,
		previousState,
		newState
	);
	sanitizeState(mergedState);

	console.debug('previous-state', previousState);
	console.debug('new-state', newState);
	console.debug('merged-state', newState);

	if (processResult.exitCode !== 0) {
		if (processResult.exitCode === undefined) {
			console.error(`${red(`It looks like you may be missing a required runtime for the given provider.\n${red(processResult.stderr)}`)}`)
		} else {
			console.error();

			if (processResult.stderr)
				console.error(red(processResult.stderr));

			const failedTests = newState.tests.filter(x => !!x.failure);
			if (failedTests.length === 0) {
				console.error(bgRed.whiteBright(`Could not run tests`));
				console.error(red(`Sometimes the logs above contain more information on the root cause. Exit code was ${processResult.exitCode}.`));

				return null;
			} else {
				await pruner.persistState(providerId, mergedState);

				console.error(bgRed.whiteBright("Failed tests"));

				for (let failedTest of failedTests) {
					console.error(red(`❌ ${failedTest.name}`));

					const failure = failedTest.failure;
					failure.message && console.error("   " + yellow(`${failure.message}`));

					if (failure.stackTrace) {
						for (let stackTraceLine of failure.stackTrace)
							console.error("     " + gray(`${stackTraceLine}`));
					}

					const lastStdoutMessages = takeRight(failure.stdout || [], 3);
					if (lastStdoutMessages.length > 0) {
						console.error();
						console.error("   " + bgGray.whiteBright(`Latest output`));

						for (let message of lastStdoutMessages)
							console.error("     " + gray(`${message}`));
					}

					console.error();
				}
			}
		}
	} else {
		await pruner.persistState(providerId, mergedState);
		console.log(bgGreen.whiteBright('✔ Tests ran successfully!'));
	}

	const actualTestRuns = chain(newState.coverage)
		.flatMap(x => x.testIds)
		.uniq()
		.map(x => newState
			.tests
			.find(y => y.id === x))
		.value();
	return actualTestRuns;
}

function sanitizeState(state: ProviderState) {
	if (!state)
		return;

	state.coverage = orderBy(state.coverage, x => x.fileId);
	state.files = orderBy(state.files, x => x.path);
	state.tests = orderBy(state.tests, x => x.name);
}

/**
 * This creates a snapshot between the last pending changes and the current pending changes with a stash commit,
 * and only saves the new snapshot commit if test run is performed without errors.
 */
async function runTestsInGitStateTransaction(providers: Provider[], args: Args) {
	const gitState = await pruner.readGitState();
	if (!gitState.branch)
		rimraf.sync(await pruner.getPrunerTempPath());

	const commitRange: CommitRange = {
		from: gitState.commit,
		to: await git.createStashCommit()
	};

	const results = await Promise.all(providers
		.map(async provider =>
			await runTestsForProvider(
				provider,
				commitRange,
				args)));

	const hasFailedTestRuns = !!results.find(x => x === null);
	if (!hasFailedTestRuns)
		await pruner.persistGitState(commitRange.to);

	return results;
}

export async function getTestsToRun(
	globPatterns: string[],
	previousState: ProviderState,
	commitRange: CommitRange
) {
	if (!previousState) {
		return {
			affected: new Array<StateTest>(),
			unaffected: new Array<StateTest>(),
			hasChanges: true
		};
	}

	const gitChangedFiles = await git.getChangedFiles(commitRange);
	const relevantGitChangedFiles = gitChangedFiles
		.filter(f => !!globPatterns
			.find(p => minimatch(f.filePath, p)));

	const affectedTests = getAffectedTests(
		relevantGitChangedFiles,
		previousState);

	const allKnownUnaffectedTests = previousState.tests
		?.filter(x => !affectedTests.find(y => y.id === x.id)) || [];

	const failingTests = previousState.tests
		?.filter(x => !!x.failure) || [];
	return {
		hasChanges: true,
		affected:
			chain([
				...affectedTests,
				...failingTests
			])
				.uniqBy(x => x.id)
				.value(),
		unaffected: allKnownUnaffectedTests
	};
}

export function getAffectedTests(
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
		.filter(test => !!test)
		.uniqBy(test => test.name)
		.value();
}