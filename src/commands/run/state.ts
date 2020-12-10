import _, { chain, last, remove } from "lodash";
import { ProviderState, StateLineCoverage, StateTest } from "../../providers/types";

export function merge<T>(args: {
	a: T[],
	b: T[],
	identifierProperty: keyof T,
	groupingKeyProperty: keyof T,
	onIdentifierChanged: (a: number, b: number) => void
}) {
	const merged = [...args.a, ...args.b];

	avoidIdentifierCollisions();

	return chain(merged)
		.groupBy(x => x[args.groupingKeyProperty])
		.map(last)
		.value();

	function avoidIdentifierCollisions() {
		const illegalIdentifiers = new Map<number, T>();
		const seenIdentifiers = new Map<number, T>();
		for (let item of merged) {
			const identifier = item[args.identifierProperty as string];
			const groupingKey = item[args.groupingKeyProperty as string];
			if (seenIdentifiers.has(identifier)) {
				const seenIdentifierItem = seenIdentifiers.get(identifier);
				if (seenIdentifierItem[args.groupingKeyProperty as string] !== groupingKey)
					illegalIdentifiers.set(identifier, item);
			} else {
				seenIdentifiers.set(identifier, item);
			}
		}

		for (let item of args.b) {
			let identifier = item[args.identifierProperty as string];
			const oldIdentifier = identifier;

			while (illegalIdentifiers.has(identifier))
				identifier++;

			if (identifier === oldIdentifier)
				continue;

			illegalIdentifiers.set(identifier, item);
			item[args.identifierProperty as string] = identifier;

			args.onIdentifierChanged(oldIdentifier, identifier);
		}
	}
}

export async function mergeStates(
	affectedTests: StateTest[],
	previousState: ProviderState,
	newState: ProviderState,
): Promise<ProviderState> {
	const mergedFiles = merge({
		a: previousState?.files || [],
		b: newState.files,
		identifierProperty: "id",
		groupingKeyProperty: "path",
		onIdentifierChanged: (oldId, newId) => {
			const coveredLinesInFile = newState.coverage.filter(x => x.fileId === oldId);
			for (let coveredLine of coveredLinesInFile)
				coveredLine.fileId = newId;
		}
	});

	const mergedTests = merge({
		a: previousState?.tests || [],
		b: newState.tests,
		identifierProperty: "id",
		groupingKeyProperty: "name",
		onIdentifierChanged: (oldId, newId) => {
			const coveredLinesWithTest = newState.coverage.filter(x => x.testIds.indexOf(oldId) > -1);
			for (let coveredLine of coveredLinesWithTest) {
				remove(coveredLine.testIds, testId => testId === oldId);
				coveredLine.testIds.push(newId);
			}
		}
	});

	const linesToRemove = getLinesPresentInOldCoverageButNotNew(previousState, newState);

	const mergedState: ProviderState = {
		tests: mergedTests,
		files: mergedFiles,
		coverage: _
			.chain([
				previousState?.coverage || [],
				newState.coverage
			])
			.flatMap()
			.filter(x => !linesToRemove.find(l =>
				l.fileId === x.fileId &&
				l.lineNumber === x.lineNumber))
			.groupBy(x => `${x.fileId}_${x.lineNumber}`)
			.map(x => ({
				fileId: last(x).fileId,
				lineNumber: last(x).lineNumber,
				testIds: _.chain(x)
					.flatMap(t => t.testIds)
					.uniq()
					.value()
			}))
			.value()
	};

	for (const testInFilter of affectedTests) {
		const newStateTestIndex = newState.tests.findIndex(x => x.name === testInFilter.name);
		const mergedStateTestIndex = mergedState.tests.findIndex(x => x.name === testInFilter.name);
		if (newStateTestIndex === -1 && mergedStateTestIndex > -1) {
			mergedState.tests.splice(mergedStateTestIndex, 1);

			mergedState.coverage.forEach(lineCoverage =>
				remove(lineCoverage.testIds, x => x === testInFilter.id));
		}
	}

	remove(
		mergedState.coverage,
		x => x.testIds.length === 0);

	return mergedState;
}

function getLinesPresentInOldCoverageButNotNew(previousState: ProviderState, newState: ProviderState) {
	if (!previousState)
		return [];

	const allNewTestIds = chain(newState.coverage)
		.flatMap(x => x.testIds)
		.uniq()
		.value();

	const linesToRemove: StateLineCoverage[] = [];
	for (const previousLineCoverage of previousState.coverage) {
		if (previousLineCoverage.testIds.length === 0)
			continue;

		const newLineCoverage = newState.coverage.find(x =>
			x.lineNumber === previousLineCoverage.lineNumber &&
			x.fileId === previousLineCoverage.fileId);
		if (newLineCoverage)
			continue;

		let shouldRemove = false;

		const previousTestIds = previousLineCoverage.testIds;

		for (const previousTestId of previousTestIds) {
			const existsInNewTests = !!allNewTestIds.find(newTestId => newTestId === previousTestId);
			if (existsInNewTests)
				shouldRemove = true;
		}

		if (shouldRemove)
			linesToRemove.push(previousLineCoverage);
	}

	return linesToRemove;
}

export function getLineCoverageForFileFromState(state: ProviderState, fileId: number) {
	return state.coverage.filter(
		previousStateLine => previousStateLine.fileId === fileId);
}

export function getFileIdFromStateForPath(state: ProviderState, path: string) {
	const file = state.files.find(x => x.path === path);
	if (!file)
		return null;

	return file.id;
}

export function getTestFromStateById(state: ProviderState, id: number): StateTest {
	return state.tests.find(y => y.id === id);
}