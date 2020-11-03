import * as ora from "ora";
import { readFromPrunerFile, writeToPrunerFile } from "./io";
import {Provider} from "./providers";
import { useSpinner } from "./misc";
import { getCurrentDiffText } from "./git";
import parseGitDiff from 'git-diff-parser';

export async function run(provider: Provider<any>) {
    await useSpinner("Running tests", async () => {
        const stateFileName = `${provider.name}.json`;
        const previousState = JSON.parse(await readFromPrunerFile(stateFileName));

        const gitDiff = parseGitDiff(await getCurrentDiffText());
        const changedLines = gitDiff
            .commits
            .flatMap(x => x.files)
            .flatMap(x => [
                {
                    lineNumbers: x.lines
                        .map(y => y.ln1)
                        .filter(y => !!y),
                    name: x.oldName
                },
                {
                    lineNumbers: x.lines
                        .map(y => y.ln2)
                        .filter(y => !!y),
                    name: x.name
                }
            ])
            .filter(x => !!x.name);

        const result = await provider.run(previousState, changedLines);
        if(result.exitCode !== 0) {
            console.error("Could not run tests.\n" + result.stdout + "\n" + result.stderr);
            return;
        }
        
        const state = await provider.gatherState();
        await writeToPrunerFile(`${provider.name}.json`, JSON.stringify(state, null, ' '));
    });
}