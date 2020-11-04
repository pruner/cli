import parseGitDiff from 'git-diff-parser';
import _ from "lodash";
import chalk from "chalk";
import { join } from "path";
import { Command } from "./Command";
import { useSpinner } from '../console';
import { getGitTopDirectory, getCurrentDiffText } from '../git';
import { writeToPrunerFile, readFromPrunerFile } from '../io';
import { allProviders, Provider, State, ProviderClass, LineCoverage } from '../providers';

type Args = {
    provider: string
}

export default {
    command: "run <provider>",
    describe: "Run tests in .NET.",
    builder: yargs => yargs
        .positional("provider", {
            choices: allProviders.map(x => x.providerName)
        }),
    handler
} as Command<Args>;

export async function handler(args: Args) {
    await useSpinner("Running tests", async () => {
        const Provider = allProviders.find(x => x.providerName === args.provider);
        const providers = await createProviders(Provider);
        for(let provider of providers)
            await runTestsForProvider(provider);
    });
}

async function runTestsForProvider(provider: Provider) {
    const changedLines = await getChangedLinesInGit();
    const previousState = await readState();

    const testsToRun = await getTestsToRun(previousState, changedLines);

    const result = await provider.executeTestProcess(testsToRun);
    if(result.exitCode !== 0) {
        console.error(chalk.red("Could not run tests.") + "\n" + chalk.yellow(result.stdout) + "\n" + chalk.red(result.stderr));
        return;
    }

    console.log(chalk.green("Tests ran successfully:"));
    console.log(chalk.white(result.stdout));
    
    const state = await provider.gatherState();

    const mergedState = await mergeState(previousState, state);
    await persistState(mergedState);

    await generateLcovFile(mergedState);
}

async function persistState(state: any) {
    const stateFileName = getStateFileName();
    await writeToPrunerFile(stateFileName, JSON.stringify(state, null, ' '));
}

async function readState() {
    const stateFileName = getStateFileName();
    return JSON.parse(await readFromPrunerFile(stateFileName));
}

function getStateFileName() {
    return `state.json`;
}

async function generateLcovFile(state: State) {
    let lcovContents = "";

    function appendLine(line: string) {
        lcovContents += `${line}\n`;
    }

    const rootDirectory = await getGitTopDirectory();

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

    await writeToPrunerFile(
        join("temp", "lcov.info"), 
        lcovContents);
}

async function getChangedLinesInGit() {
    const gitDiff = parseGitDiff(await getCurrentDiffText());
    console.log("git-diff", gitDiff
        .commits
        .flatMap(x => x.files));

    const changedLines = gitDiff
        .commits
        .flatMap(x => x.files)
        .flatMap(x => ({
            lineNumbers: _.chain(x.lines)
                .filter(line => 
                    line.type === "added" ||
                    line.type === "deleted")
                .flatMap(y => [y.ln1, y.ln2])
                .filter(y => !!y)
                .uniq()
                .value(),
            name: x.name || x.oldName
        }))
        .filter(x => !!x.name && x.lineNumbers.length > 0);
    return changedLines;
}

async function createProviders(Provider: ProviderClass<any>) {
    const settings = JSON.parse(await readFromPrunerFile("settings.json"));
    console.log("settings", settings);

    const providerSettings = settings[Provider.providerName] as any[];

    return providerSettings.map(x => new Provider(x));
}

async function mergeState(previousState: State, newState: State): Promise<State> {
    console.log("previous", previousState?.coverage.filter(x => x.fileId === 2));
    console.log("new", newState.coverage.filter(x => x.fileId === 2));

    const linesToRemove: LineCoverage[] = [];
    if(previousState) {
        for(let previousLine of previousState.coverage) {
            if(previousLine.testIds.length === 0)
                continue;
                
            const newLine = newState.coverage.find(x => 
                x.lineNumber === previousLine.lineNumber &&
                x.fileId === previousLine.fileId);
            if(!newLine) {
                linesToRemove.push(previousLine);
                continue;
            }
            
            // let remove = true;

            // const previousTestIds = previousLine.testIds;
            // const newTestIds = newLine.testIds;

            // for(let previousTestId of previousTestIds) {
            //     const existsInNewTests = !!newTestIds.find(newTestId => newTestId === previousTestId);
            //     if(existsInNewTests) 
            //         remove = false;
            // }

            // linesToRemove.push(previousLine);
        }
    }

    const mergedState: State = {
        tests: _.chain([previousState?.tests || [], newState.tests || []])
            .flatMap()
            .uniqBy(x => x.name)
            .value(),
        files: _.chain([previousState?.files || [], newState.files || []])
            .flatMap()
            .uniqBy(x => x.path)
            .value(),
        coverage: _.chain([previousState?.coverage || [], newState.coverage])
            .flatMap()
            .filter(x => !linesToRemove.find(l => 
                l.fileId === x.fileId && 
                l.lineNumber === x.lineNumber))
            .uniqBy(x => x.fileId + "-" + x.lineNumber)
            .value()
    };

    return mergedState;
}

async function getTestsToRun(previousState: State, changedFiles: ChangedFiles) {
    if(!previousState) {
        return {
            affected: [],
            unaffected: []
        };
    }

    const affectedTests = changedFiles
        .flatMap(changedFile => {
            const file = previousState.files.find(x => x.path === changedFile.name);
            if(!file)
                return [];

            const linesInFile = previousState.coverage.filter(x => x.fileId === file.id);
            const affectedLines = linesInFile.filter(x => changedFile.lineNumbers.indexOf(x.lineNumber) > -1);
            return _.flatMap(affectedLines, x => x.testIds);
        })
        .map(x => previousState.tests.find(y => y.id === x));
    
    const allKnownUnaffectedTests = previousState.tests.filter(x => !affectedTests.find(y => y.id === x.id));
    return {
        affected: affectedTests,
        unaffected: allKnownUnaffectedTests
    };
}

type ChangedFiles = Array<{
    lineNumbers: number[],
    name: string
}>;