import { flatMap, chain } from "lodash";
import { CommitRange, FileChanges } from "../../git";
import { ProviderState, StateTest } from "../../providers/types";
import { getTestFromStateById } from "./state";

import { red, yellow, green, white } from "chalk";
import { Provider } from "../../providers/types";
import { generateLcovFile } from "./lcov";
import { mergeStates } from "./state";

import git from '../../git';
import pruner from '../../pruner';
import con from '../../console';
import { getLineCoverageForGitChangedFile, getNewLineNumberForLineCoverage, hasCoverageOfLineInSurroundingLines } from "./changes";

export async function runTestsForProviders(providers: Provider[]) {
	const results = await runInGitStateTransaction(async commitRange =>
		await Promise.all(providers
			.map(async provider =>
				await runTestsForProvider(
					provider,
					commitRange))));
	return flatMap(results);
}

export async function runTestsForProvider(
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
		if (processResult.exitCode === undefined) {
			console.error(`${red(`It seems like the .NET SDK is not installed.\n${red(processResult.stderr)}`)}`)
		} else {
			console.error(`${red(`Could not run tests. Exit code ${processResult.exitCode}.`)}\n${yellow(processResult.stdout)}\n${red(processResult.stderr)}`);
		}
		return [];
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

	console.debug('previous-state', previousState);
	console.debug('new-state', state);
	console.debug('merged-state', state);

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

/**
 * This creates a snapshot between the last pending changes and the current pending changes with a stash commit,
 * and only saves the new snapshot commit if the action is performed without errors.
 */
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

export async function getTestsToRun(
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

	const failingTests = previousState.tests.filter(x => !x.passed);
	return {
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
		.uniqBy(test => test.name)
		.value();
}