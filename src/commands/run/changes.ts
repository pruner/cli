import { chain, flatMap } from "lodash";
import { FileChanges } from "../../git";
import { ProviderState } from "../../providers/types";


export function getNewLineNumberForLineCoverage(gitChangedFile: FileChanges, coveredLineNumber: number) {
	const gitUnchangedLine = gitChangedFile.unchanged
		.find(x => x.oldLineNumber === coveredLineNumber);

	const newLineNumber =
		gitUnchangedLine?.newLineNumber ||
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
	return chain(previousState.tests)
		.flatMap(test => flatMap(test.fileCoverage, file => ({
			test: test,
			file: file
		})))
		.flatMap(x => flatMap(x.file.lineCoverage, lineNumber => ({
			test: x.test,
			file: x.file,
			lineNumber: lineNumber
		})))
		.filter(x =>
			x.file.path === gitChangedFile.filePath)
		.value();
}