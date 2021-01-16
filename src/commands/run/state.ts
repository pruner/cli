import { chain, orderBy } from "lodash";
import { ProviderState, StateTest } from "../../providers/types";

export async function mergeStates(
	affectedTests: StateTest[],
	previousState: ProviderState,
	newState: ProviderState
): Promise<ProviderState> {
	//https://github.com/pruner/cli/blob/aeb84fa16537606d0a6bb527710ca33df8b85483/src/commands/run/state.ts

	const result: ProviderState = {
		tests: previousState.tests
	};

	for (let newStateTest of newState.tests) {
		const previousStateTest = previousState.tests.find(t => t.name === newStateTest.name);
		if (previousStateTest) {
			for (let newFileCoverage of newStateTest.fileCoverage) {
				const previousFileCoverage = previousStateTest.fileCoverage.find(x => x.path === newFileCoverage.path);
				if (previousFileCoverage) {
					previousFileCoverage.lineCoverage = chain([...previousFileCoverage.lineCoverage, ...newFileCoverage.lineCoverage])
						.uniq()
						.orderBy()
						.value();
				} else {
					previousStateTest.fileCoverage.push(newFileCoverage);
				}
			}
		} else {
			result.tests.push(newStateTest);
		}
	}

	result.tests = orderBy(result.tests, x => x.name);

	for (let test of result.tests) {
		test.fileCoverage = orderBy(test.fileCoverage, x => x.path);
	}

	return result;
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