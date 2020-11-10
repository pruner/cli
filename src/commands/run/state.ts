import _, { chain, last, remove, sortBy } from "lodash";
import { ProviderState, StateLineCoverage, StateTest } from "../../providers/types";

export function merge<T>(args: {
	a: T[],
	b: T[],
	identifierAccessor: keyof T,
	groupingKeyAccessor: keyof T,
	onIdentifierChanged: (a: number, b: number) => void
}) {
	const merged = [...args.a, ...args.b];

	avoidIdentifierCollisions();

	return merged;

	function avoidIdentifierCollisions() {
		const illegalIdentifiers = new Set<number>();
		const seenIdentifiers = new Set<number>();
		for (let item of merged) {
			const identifier = item[args.identifierAccessor as string];
			if (seenIdentifiers.has(identifier))
				illegalIdentifiers.add(identifier);

			seenIdentifiers.add(identifier);
		}

		for (let item of args.b) {
			let identifier = item[args.identifierAccessor as string];
			const oldIdentifier = identifier;

			while (illegalIdentifiers.has(identifier))
				identifier++;

			illegalIdentifiers.add(identifier);
			item[args.identifierAccessor as string] = identifier;

			args.onIdentifierChanged(oldIdentifier, identifier);
		}
	}
}

export async function mergeStates(
	affectedTests: StateTest[],
	previousState: ProviderState,
	newState: ProviderState,
): Promise<ProviderState> {
	const linesToRemove = getLinesPresentInOldCoverageButNotNew(previousState, newState);

	const mergedState: ProviderState = {
		tests: _
			.chain([
				previousState?.tests || [],
				newState.tests || []
			])
			.flatMap()
			.groupBy(x => x.name)
			.map(x => x
				.find(y => newState
					.tests
					.find(t => t.name === y.name)) || x[0])
			.value(),
		files: _
			.chain([
				previousState?.files || [],
				newState.files || [],
			])
			.flatMap()
			.groupBy(x => x.path)
			.map(x => x
				.find(y => newState
					.files
					.find(t => t.path === y.path)) || x[0])
			.value(),
		coverage: _
			.chain([
				previousState?.coverage || [],
				newState.coverage
			])
			.flatMap()
			.filter(x => !linesToRemove.find(l =>
				l.fileId === x.fileId &&
				l.lineNumber === x.lineNumber))
			.groupBy(x => `${x.fileId}-${x.lineNumber}`)
			.map(x => x
				.find(y => newState
					.coverage
					.find(l =>
						l.fileId === y.fileId &&
						l.lineNumber === y.lineNumber)) || x[0])
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

		let remove = false;

		const previousTestIds = previousLineCoverage.testIds;

		for (const previousTestId of previousTestIds) {
			const existsInNewTests = !!allNewTestIds.find(newTestId => newTestId === previousTestId);
			if (existsInNewTests)
				remove = true;
		}

		if (remove)
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