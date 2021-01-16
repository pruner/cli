import { chain, flatMap, orderBy } from "lodash";
import { ProviderState, StateTest } from "../../providers/types";

export async function mergeStates(
	affectedTests: StateTest[],
	previousState: ProviderState,
	newState: ProviderState
): Promise<ProviderState> {
	//https://github.com/pruner/cli/blob/aeb84fa16537606d0a6bb527710ca33df8b85483/src/commands/run/state.ts

	const mergedState: ProviderState = {
		tests: JSON.parse(JSON.stringify(previousState?.tests || []))
	};

	for (let newStateTest of newState.tests) {
		const previousStateTest = mergedState.tests.find(t => t.name === newStateTest.name);
		if (previousStateTest) {
			previousStateTest.duration = newStateTest.duration || previousStateTest.duration || null;

			if (newStateTest.fileCoverage.length > 0)
				previousStateTest.failure = newStateTest.failure || null;

			for (let newFileCoverage of newStateTest.fileCoverage) {
				const previousFileCoverage = previousStateTest.fileCoverage.find(x => x.path === newFileCoverage.path);
				if (previousFileCoverage) {
					previousFileCoverage.lineCoverage = orderBy(newFileCoverage.lineCoverage);
				} else {
					previousStateTest.fileCoverage.push(newFileCoverage);
				}
			}
		} else {
			mergedState.tests.push(newStateTest);
		}
	}

	removeTestsFromStateThatNoLongerExists(affectedTests, newState, mergedState);

	mergedState.tests = orderBy(mergedState.tests, x => x.name);

	for (let test of mergedState.tests) {
		test.fileCoverage = orderBy(test.fileCoverage, x => x.path);
	}

	return mergedState;
}

function removeTestsFromStateThatNoLongerExists(affectedTests: StateTest[], newState: ProviderState, mergedState: ProviderState) {
	for (const testInFilter of affectedTests) {
		const newStateTestIndex = newState.tests.findIndex(x => x.name === testInFilter.name);
		const mergedStateTestIndex = mergedState.tests.findIndex(x => x.name === testInFilter.name);
		if (newStateTestIndex === -1 && mergedStateTestIndex > -1)
			mergedState.tests.splice(mergedStateTestIndex, 1);
	}
}

export function getLineCoverageForFileFromState(state: ProviderState, filePath: string) {
	return chain(state.tests)
		.flatMap(test => test.fileCoverage.flatMap(file => ({
			test: test,
			file: file
		})))
		.flatMap(x => x.file.lineCoverage.flatMap(lineNumber => ({
			test: x.test,
			file: x.file,
			lineNumber: lineNumber
		})))
		.filter(x => x.file.path === filePath)
		.value();
}