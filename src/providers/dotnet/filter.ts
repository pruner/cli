import { StateTest, TestsByAffectedState } from "../types";
import { DotNetSettings } from "./DotNetProvider";

export function getFilter(tests: TestsByAffectedState, settings: DotNetSettings) {
	const unknownFilter = getTestFilterArgument(tests.unaffected, {
		compare: "!=",
		join: "&"
	});

	const affectedFilter = getTestFilterArgument(tests.affected, {
		compare: "=",
		join: "|"
	});

	const categoriesFilter = settings
		.msTest
		?.categories
		.map(x => `TestCategory=${x}`);

	const filterArgument = combineFilterArguments(
		[
			combineFilterArguments(
				[
					affectedFilter,
					unknownFilter
				],
				'|'),
			combineFilterArguments(
				categoriesFilter,
				'|')
		],
		'&');

	return filterArgument;
}

function getTestFilterArgument(
	tests: StateTest[],
	operandSettings: { join: string; compare: string; }) {
	return tests
		.map(x => `FullyQualifiedName${operandSettings.compare}${x.name}`)
		.join(operandSettings.join);
}

function combineFilterArguments(orFilters: string[], join: string) {
	return orFilters
		?.filter(x => !!x)
		.map(x => `(${x})`)
		.join(join);
}