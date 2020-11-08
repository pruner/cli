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
				const testsRunningThroughLine = line.testIds.map(id =>
					state.tests.find(t => t.id === id));

				const isCovered = testsRunningThroughLine.length > 0;
				if (!isCovered)
					continue;

				const isFailing = !!testsRunningThroughLine.find(x => !x.passed);
				appendLine(`DA:${line.lineNumber},${isFailing ? 0 : 1}`);
			}

			appendLine('end_of_record');
		}
	}

	await pruner.writeToTempFile(
		join(providerId, 'lcov.info'),
		lcovContents);
}