import { readFromPrunerFile, writeToPrunerFile } from "./io";
import {ProviderClass} from "./providers";
import { useSpinner } from "./console";
import { getCurrentDiffText } from "./git";
import * as parseGitDiff from 'git-diff-parser';
import * as _ from "lodash";
import * as chalk from "chalk";

export async function runTests(Provider: ProviderClass<any, any>) {
    await useSpinner("Running tests", async () => {
        const providers = await createProviders(Provider);
        for(let provider of providers) {
            const changedLines = await getChangedLinesInGit();

            const previousState = await readState(Provider);

            const result = await provider.executeTestProcess(previousState, changedLines);
            if(result.exitCode !== 0) {
                console.error(chalk.red("Could not run tests.") + "\n" + chalk.yellow(result.stdout) + "\n" + chalk.red(result.stderr));
                return;
            }

            console.log(chalk.green("Tests ran successfully:"));
            console.log(chalk.white(result.stdout));
            
            const state = await provider.gatherState();
            const mergedState = await provider.mergeState(previousState, state);

            await persistState(Provider, mergedState);
        }
    });
}

async function persistState(Provider: ProviderClass<any, any>, state: any) {
    const stateFileName = getStateFileName(Provider);
    await writeToPrunerFile(stateFileName, JSON.stringify(state, null, ' '));
}

async function readState(Provider: ProviderClass<any, any>) {
    const stateFileName = getStateFileName(Provider);
    return JSON.parse(await readFromPrunerFile(stateFileName));
}

function getStateFileName(Provider: ProviderClass<any, any>) {
    return `${Provider.providerName}.json`;
}

async function getChangedLinesInGit() {
    const gitDiff = parseGitDiff(await getCurrentDiffText());

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

async function createProviders(Provider: ProviderClass<any, any>) {
    const settings = JSON.parse(await readFromPrunerFile("settings.json"));
    const providerSettings = settings[Provider.providerName] as any[];

    return providerSettings.map(x => new Provider(x));
}
