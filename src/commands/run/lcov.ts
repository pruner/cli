import git from '../../git';
import pruner from '../../pruner';

import { join } from "path";
import { ProviderState } from '../../providers/types';

export async function generateLcovFile(providerId: string, state?: ProviderState) {
    let lcovContents = '';

    function appendLine(line: string) {
        lcovContents += `${line}\n`;
    }

    const rootDirectory = await git.getGitTopDirectory();

    if (state) {
        for (const file of state.files) {
            const fullPath = join(rootDirectory, file.path);
            appendLine(`SF:${fullPath}`);

            const lines = state.coverage.filter(x => x.fileId === file.id);
            for (const line of lines) {
                const isCovered = line.testIds.length > 0;
                appendLine(`DA:${line.lineNumber},${isCovered ? 1 : 0}`);
            }

            appendLine('end_of_record');
        }
    }

    await pruner.writeToTempFile(
        join(providerId, 'lcov.info'),
        lcovContents);
}