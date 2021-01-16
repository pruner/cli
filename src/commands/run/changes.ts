import { FileChanges } from "../../git";
import { ProviderState } from "../../providers/types";
import { getLineCoverageForFileFromState } from "./state";


export function getNewLineNumberForLineCoverage(gitChangedFile: FileChanges, coveredLineNumber: number) {
	const gitUnchangedLine = gitChangedFile.unchanged
		.find(x => x.oldLineNumber === coveredLineNumber);

	const newLineNumber = gitUnchangedLine?.newLineNumber ||
		coveredLineNumber;
	return newLineNumber;
}

/**
 * This function exists in case we have added a new line,
 * and therefore don't have coverage data on that line,
 * so we check nearby surrounding lines instead.
 */
export function hasCoverageOfLineInSurroundingLines(
	line: number,
	allLines: number[],
) {
	return (
		allLines.indexOf(line - 1) > -1 ||
		allLines.indexOf(line) > -1
	);
}

export function getLineCoverageForGitChangedFile(
	previousState: ProviderState,
	gitChangedFile: FileChanges,
) {
	return getLineCoverageForFileFromState(
		previousState,
		gitChangedFile.filePath);
}