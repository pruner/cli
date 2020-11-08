import { FileChanges } from "../../git";
import { StateLineCoverage, ProviderState } from "../../providers/types";
import { getFileIdFromStateForPath, getLineCoverageForFileFromState } from "./state";


export function getNewLineNumberForLineCoverage(gitChangedFile: FileChanges, gitLineCoverage: StateLineCoverage) {
	const gitUnchangedLine = gitChangedFile.unchanged
		.find(x => x.oldLineNumber === gitLineCoverage.lineNumber);

	const newLineNumber = gitUnchangedLine?.newLineNumber ||
		gitLineCoverage.lineNumber;
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
	const fileIdForGitChange = getFileIdFromStateForPath(
		previousState,
		gitChangedFile.filePath);

	return getLineCoverageForFileFromState(
		previousState,
		fileIdForGitChange);
}