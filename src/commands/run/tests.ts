import { flatMap, chain, takeRight } from "lodash";
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

	const previousState = await pruner.readState(providerId);

	const testsToRun = await getTestsToRun(
		previousState,
		commitRange);
	if (!testsToRun.hasChanges) {
		console.log(gray("No GIT changes were detected since the last test run, so there are no affected tests."));
		return [];
	}

	const processResult = await con.useSpinner(
		'Running tests',
		async () => await provider.executeTestProcess(testsToRun));

	const newState = await provider.gatherState() || {
		coverage: [],
		files: [],
		tests: []
	};

	const mergedState = await mergeStates(
		testsToRun.affected,
		previousState,
		newState
	);

	console.debug('previous-state', previousState);
	console.debug('new-state', newState);
	console.debug('merged-state', newState);

	await pruner.persistState(providerId, mergedState);

	if (processResult.exitCode !== 0) {
		if (processResult.exitCode === undefined) {
			console.error(`${red(`It seems like the .NET SDK is not installed.\n${red(processResult.stderr)}`)}`)
		} else {
			console.error(bgRed.whiteBright(`Could not run tests. Exit code ${processResult.exitCode}.`));
			console.error(red(processResult.stderr));

			const failedTests = newState.tests.filter(x => !!x.failure);
			if (failedTests.length > 0) {
				console.error();
				console.error(bgRed.whiteBright("Failed tests"));

				for (let failedTest of failedTests) {
					console.error(red(`❌ ${failedTest.name}`));

					const failure = failedTest.failure;
					failure.message && console.error("   " + yellow(`${failure.message}`));

					if (failure.stackTrace) {
						for (let stackTraceLine of failure.stackTrace)
							console.error("     " + white(`${stackTraceLine}`));
					}

					const lastStdoutMessages = takeRight(failure.stdout || [], 3);
					if (lastStdoutMessages.length > 0) {
						console.log();
						console.error("   " + bgGray.whiteBright(`Latest output`));

						for (let message of lastStdoutMessages)
							console.error("     " + gray(`${message}`));

						console.log();
					}
				}
			}
		}
	} else {
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
			unaffected: new Array<StateTest>(),
			hasChanges: true
		};
	}

	const gitChangedFiles = await git.getChangedFiles(commitRange);
	if (gitChangedFiles.length === 0) {
		return {
			affected: new Array<StateTest>(),
			unaffected: new Array<StateTest>(),
			hasChanges: false
		};
	}

	const affectedTests = getAffectedTests(
		gitChangedFiles,
		previousState);

	const allKnownUnaffectedTests = previousState.tests
		.filter(x => !affectedTests.find(y => y.id === x.id));

	const failingTests = previousState.tests.filter(x => !!x.failure);
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
		.uniqBy(test => test.name)
		.value();
}