import _, { chain, last, min, minBy, remove, sortBy } from "lodash";
import { Provider, ProviderState, StateFile, StateFileId, StateLineCoverage, StateTest, StateTestId } from "../../providers/types";

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

export async function mergeStates(
	affectedTests: StateTest[],
	previousState: ProviderState,
	newState: ProviderState,
): Promise<ProviderState> {
	const previousStateDecorator = new StateDecorator(previousState);
	const newStateDecorator = new StateDecorator(newState);

	//TODO: call changeId on all existing tests and files on the previous and new states, and rename to GUIDs first, or something similar. then no conflicts will occur on merge.

	for (let newFile of newStateDecorator.files.all) {
		const previousFile = previousStateDecorator.files.byName.get(newFile.path);
		if (!previousFile)
			continue;

		if (previousFile.id !== newFile.id) {
			newFile.changeId(previousFile.id + "-temp");
		}

		//TODO: change all coverage files of newStateDecorator for file to point to previous file.
	}
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