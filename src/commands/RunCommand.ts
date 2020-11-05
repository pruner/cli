import parseGitDiff = require('git-diff-parser');
import {chain, flatMap} from "lodash";
import { green, red, white, yellow } from "chalk";
import { join } from "path";
import { Command } from "./Command";
import { useSpinner } from '../console';
import git from '../git';
import io from '../io';
import chokidar = require('chokidar');
import { allProviders, Provider, State, ProviderClass, LineCoverage, Settings } from '../providers';

type Args = {
    provider?: string,
    watch?: boolean
}

export default {
    command: "run [provider]",
    describe: "Run tests.",
    builder: yargs => yargs
        .positional("provider", {
            choices: allProviders.map(x => x.providerName),
            demandOption: false,
            type: "string",
            describe: "The provider to run tests for. If not specified, runs all tests."
        })
        .option("watch", {
            alias: "w",
            type: "boolean",
            demandOption: false,
            describe: "Launches in watch mode (run tests as files change)."
        }),
    handler
} as Command<Args>;

export async function handler(args: Args) {
    const providerPairs = await createProvidersFromArguments(args);
    await runTestsForProviders(providerPairs.map(x => x.provider));

    if(args.watch) {
        for(let providerPair of providerPairs) {
            watchProvider(
                providerPair.provider, 
                providerPair.settings);
        }
    }
}

function watchProvider(provider: Provider, settings: Settings) {
    let isRunning = false;
    let hasPending = false;

    const runTests = async () => {
        if(isRunning) {
            hasPending = true;
            return;
        }

        isRunning = true;

        await runTestsForProvider(provider);

        if(hasPending) {
            hasPending = false;
            await runTestsForProvider(provider);
        }

        isRunning = false;
    };

    const paths = provider
        .getGlobPatterns()
        .map(x => join(settings.workingDirectory, x));

    const watcher = chokidar.watch(paths, {
        atomic: 1000,
        ignorePermissionErrors: true,
        useFsEvents: true,
        persistent: true
    });
    watcher.on('change', runTests);
    watcher.on('add', runTests);
    watcher.on('unlink', runTests);
    watcher.on('addDir', runTests);
    watcher.on('unlinkDir', runTests);
}

async function runTestsForProviders(providers: Provider[]) {
    for (let provider of providers)
        await runTestsForProvider(provider);
}

async function createProvidersFromArguments(args: Args) {
    const classes = args.provider ?
        [allProviders.find(x => x.providerName === args.provider)] :
        allProviders;
    const providerPairs = await Promise.all(classes.map(createProvidersFromClass));
    return flatMap(providerPairs, x => x);
}

async function runTestsForProvider(provider: Provider) {
    const previousState = await readState();

    const result = await useSpinner("Running tests", async () => {
        const testsToRun = await getTestsToRun(previousState);
        return await provider.executeTestProcess(testsToRun);
    });
    
    if(result.exitCode !== 0) {
        console.error(red("Could not run tests.") + "\n" + yellow(result.stdout) + "\n" + red(result.stderr));
        return;
    }

    console.log(green("Tests ran successfully:"));
    console.log(white(result.stdout));

    const state = await provider.gatherState();

    const mergedState = await mergeState(previousState, state);
    await persistState(mergedState);

    await generateLcovFile(mergedState);
}

async function persistState(state: any) {
    const stateFileName = getStateFileName();
    await io.writeToPrunerFile(stateFileName, JSON.stringify(state, null, ' '));
}

async function readState() {
    const stateFileName = getStateFileName();
    return JSON.parse(await io.readFromPrunerFile(stateFileName));
}

function getStateFileName() {
    return `state.json`;
}

async function generateLcovFile(state: State) {
    let lcovContents = "";

    function appendLine(line: string) {
        lcovContents += `${line}\n`;
    }

    const rootDirectory = await git.getGitTopDirectory();

    for(let file of state.files) {
        const fullPath = join(rootDirectory, file.path);
        appendLine(`SF:${fullPath}`);
        
        const lines = state.coverage.filter(x => x.fileId === file.id);
        for(let line of lines) {
            const isCovered = line.testIds.length > 0;
            appendLine(`DA:${line.lineNumber},${isCovered ? 1 : 0}`);
        }

        appendLine("end_of_record");
    }

    await io.writeToPrunerFile(
        join("temp", "lcov.info"), 
        lcovContents);
}

async function getChangedLinesInGit() {
    const diffText = await git.getCurrentDiffText();
    const gitDiff = parseGitDiff(diffText);

    const changedLines = gitDiff
        .commits
        .flatMap(x => x.files)
        .flatMap(x => {
            const lineNumbers =  chain(x.lines)
                .filter(line => 
                    line.type === "added" ||
                    line.type === "deleted")
                .flatMap(y => [y.ln1, y.ln2])
                .filter(y => !!y)
                .uniq()
                .value();
            return [
                {
                    lineNumbers,
                    name: io.normalizePathSeparators(x.oldName)
                },
                {
                    lineNumbers,
                    name: io.normalizePathSeparators(x.name)
                }
            ];
        })
        .filter(x => !!x.name && x.lineNumbers.length > 0);

    return changedLines;
}

async function createProvidersFromClass(Provider: ProviderClass<Settings>) {
    const settings = JSON.parse(await io.readFromPrunerFile("settings.json"));
    const providerSettings = settings[Provider.providerName] as Settings[];

    return providerSettings.map(x => ({
        provider: new Provider(x),
        settings: x
    }));
}

async function mergeState(previousState: State, newState: State): Promise<State> {
    const allNewTestIds = chain(newState.coverage)
        .flatMap(x => x.testIds)
        .uniq()
        .value();

    const linesToRemove: LineCoverage[] = [];
    if(previousState) {
        for(let previousLine of previousState.coverage) {
            if(previousLine.testIds.length === 0)
                continue;
                
            const newLine = newState.coverage.find(x => 
                x.lineNumber === previousLine.lineNumber &&
                x.fileId === previousLine.fileId);
            if(newLine)
                continue;

            let remove = false;

            const previousTestIds = previousLine.testIds;

            for(let previousTestId of previousTestIds) {
                const existsInNewTests = !!allNewTestIds.find(newTestId => newTestId === previousTestId);
                if(existsInNewTests) 
                    remove = true;
            }

            if(remove)
                linesToRemove.push(previousLine);
        }
    }

    const mergedState: State = {
        tests: chain([previousState?.tests || [], newState.tests || []])
            .flatMap()
            .uniqBy(x => x.name)
            .value(),
        files: chain([previousState?.files || [], newState.files || []])
            .flatMap()
            .uniqBy(x => x.path)
            .value(),
        coverage: chain([previousState?.coverage || [], newState.coverage])
            .flatMap()
            .filter(x => !linesToRemove.find(l => 
                l.fileId === x.fileId && 
                l.lineNumber === x.lineNumber))
            .uniqBy(x => x.fileId + "-" + x.lineNumber)
            .value()
    };

    return mergedState;
}

async function getTestsToRun(previousState: State) {
    if(!previousState) {
        return {
            affected: [],
            unaffected: []
        };
    }

    const changedLines = await getChangedLinesInGit();
    const affectedTests = changedLines
        .flatMap(changedFile => {
            const file = previousState.files.find(x => x.path === changedFile.name);
            if(!file)
                return [];

            const linesInFile = previousState.coverage.filter(x => x.fileId === file.id);
            const affectedLines = linesInFile.filter(x => changedFile.lineNumbers.indexOf(x.lineNumber) > -1);
            return flatMap(affectedLines, x => x.testIds);
        })
        .map(x => previousState.tests.find(y => y.id === x));
    
    const allKnownUnaffectedTests = previousState.tests.filter(x => !affectedTests.find(y => y.id === x.id));
    return {
        affected: affectedTests,
        unaffected: allKnownUnaffectedTests
    };
}