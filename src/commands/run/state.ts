import _, { chain, remove } from "lodash";
import { State, StateLineCoverage, StateTest } from "../../providers/types";
import io from '../../io';

export async function mergeState(
    affectedTests: StateTest[],
    previousState: State,
    newState: State,
): Promise<State> {
    const allNewTestIds = chain(newState.coverage)
        .flatMap(x => x.testIds)
        .uniq()
        .value();

    const linesToRemove: StateLineCoverage[] = [];
    if (previousState) {
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
    }

    const mergedState: State = {
        commitId: newState.commitId,
        tests: _
            .chain([
                previousState?.tests || [],
                newState.tests || []
            ])
            .flatMap()
            .uniqBy(x => x.name)
            .value(),
        files: _
            .chain([
                previousState?.files || [],
                newState.files || [],
            ])
            .flatMap()
            .uniqBy(x => x.path)
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
            .uniqBy(x => `${x.fileId}-${x.lineNumber}`)
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

export async function persistState(state: State) {
    const stateFileName = getStateFileName();
    await io.writeToPrunerFile(
        stateFileName,
        JSON.stringify(
            state,
            null,
            ' '));
}

export async function readState(): Promise<State> {
    const stateFileName = getStateFileName();
    return JSON.parse(
        await io.readFromPrunerFile(stateFileName));
}

function getStateFileName() {
    return `state.json`;
}