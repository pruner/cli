import _, { chain, last, min, minBy, remove, sortBy } from "lodash";
import { ProviderState, StateFile, StateFileId, StateLineCoverage, StateTest, StateTestId } from "../../providers/types";

type StateReferenceIdChangedCallback = (fromId: string, toId: string) => void;

type Reference = {
	changeId?(to: string);
}
class StateReferences<T extends Reference> {
	private readonly idChangedListeners: StateReferenceIdChangedCallback[];

	public readonly byId: Map<string, T>;
	public readonly byName: Map<string, T>;

	public readonly all: T[];

	constructor(
		private readonly references: T[],
		private readonly idAccessor: (input: T) => string,
		private readonly nameAccessor: (input: T) => string) {

		this.idChangedListeners = [];
		this.all = [];

		this.byName = new Map<string, T[]>();
		this.byId = new Map<string, T[]>();

		for (let reference of references) {
			this.all.push(reference);

			this.byId.set(idAccessor(reference), reference);
			this.byName.set(nameAccessor(reference), reference);
		}
	}

	public addIdChangeListener(callback: StateReferenceIdChangedCallback) {
		this.idChangedListeners.push(callback);
	}

	public changeId(from: string, to: string) {
		const old = this.byId[from];
		this.byId.delete(from);
		this.byId.set(this.idAccessor(old), old);

		for (let listener of this.idChangedListeners)
			listener(from, to);
	}
}

class StateDecorator {
	public readonly files: StateReferences<StateFileDecorator>;
	public readonly tests: StateReferences<StateTestDecorator>;
	public readonly coverage: StateReferences<StateLineCoverageDecorator>;

	constructor(inner: ProviderState) {
		this.files = new StateReferences(inner.files.map(x => new StateFileDecorator(this, x)));
		this.tests = new StateReferences(inner.tests.map(x => new StateTestDecorator(this, x)));
		this.coverage = new StateReferences(inner.coverage.map(x => new StateLineCoverageDecorator(this, x)));
	}
}

class StateFileDecorator implements Reference, StateFile {
	get id() {
		return this.inner.id;
	}

	get path() {
		return this.inner.path;
	}

	constructor(
		private readonly state: StateDecorator,
		private readonly inner: StateFile) {

	}

	public changeId(to: string) {
		this.state.files.changeId(this.inner.id, to);
		this.inner.id = to;
	}
}

class StateTestDecorator implements Reference, StateTest {
	get name() {
		return this.inner.name;
	}

	get id() {
		return this.inner.id;
	}

	get duration() {
		return this.inner.duration;
	}

	get failure() {
		return this.inner.failure;
	}

	constructor(
		private readonly state: StateDecorator,
		private readonly inner: StateTest) {
	}

	public changeId(to: string) {
		this.state.tests.changeId(this.inner.id, to);
		this.inner.id = to;
	}
}

class StateLineCoverageDecorator {
	public readonly file: StateFileDecorator;
	public readonly tests: StateTestDecorator[];

	constructor(
		private readonly state: StateDecorator,
		private readonly inner: StateLineCoverage) {

		this.file = new StateFileDecorator(state, state.files.byId(inner.fileId));
		this.tests = inner.testIds.map(testId => new StateTestDecorator(state, state.tests.byId(testId)));

		state.files.addIdChangeListener((from, to) => {
			if (from === this.inner.fileId)
				this.inner.fileId = to;
		});

		state.tests.addIdChangeListener((from, to) => {
			const index = this.inner.testIds.indexOf(from);
			if (index === -1)
				continue;

			this.inner.testIds.splice(index, 1);
			this.inner.testIds.push(to);
		});
	}
}

function getOffsetFromId(id: string) {
	return +id.substr(1);
}

function getTypeFromId(id: string) {
	return id.substr(0, 1);
}

export function merge<T>(args: {
	a: T[],
	b: T[],
	idProperty: string,
	groupingKeyProperty: string,
	onIdentifierChanged: (a: any, b: any) => void
}) {
	const renameInstructions = new Array<{
		target: T,
		fromId: string,
		toId: string
	}>();

	const mergeInstructions = new Array<{
		target: T,
	}>();

	const getId = (x: T) => x[args.idProperty];
	const getGroupingKey = (x: T) => x[args.groupingKeyProperty];

	const allById = new Map<string, T[]>();

	const aById = new Map<string, T>();
	for (let a of args.a) {
		aById.set(getId(a), a);

		if (!allById.has(getId(a)))
			allById.set(getId(a), []);

		allById.get(getId(a)).push(a);
	}

	const bById = new Map<string, T>();
	for (let b of args.b) {
		bById.set(getId(b), b);

		if (!allById.has(getId(b)))
			allById.set(getId(b), []);

		allById.get(getId(b)).push(b);
	}

	for (let item of allById.values()) {

	}

	const merged = sortBy(
		[
			...args.a,
			...args.b.filter(b => !aById.has(getId(b)))
		],
		getGroupingKey);

	let offset = 1;
	for (let item of merged) {
		const oldIdentifier = getId(item);
		const newIdentifier = getTypeFromId(oldIdentifier) + (offset++);
		if (oldIdentifier === newIdentifier)
			continue;

		if (allById.has(newIdentifier))
			newIdentifier += "-temp";

		item[args.idProperty] = newIdentifier;
		args.onIdentifierChanged(oldIdentifier, newIdentifier);
	}

	return merged;
}

export async function mergeStates(
	affectedTests: StateTest[],
	previousState: ProviderState,
	newState: ProviderState,
): Promise<ProviderState> {
	const mergedFiles = merge({
		a: previousState?.files || [],
		b: newState.files,
		idProperty: "id",
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
		idProperty: "id",
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

export function getLineCoverageForFileFromState(state: ProviderState, fileId: StateFileId) {
	return state.coverage.filter(
		previousStateLine => previousStateLine.fileId === fileId);
}

export function getFileIdFromStateForPath(state: ProviderState, path: string) {
	const file = state.files.find(x => x.path === path);
	if (!file)
		return null;

	return file.id;
}

export function getTestFromStateById(state: ProviderState, id: StateTestId): StateTest {
	return state.tests.find(y => y.id === id);
}