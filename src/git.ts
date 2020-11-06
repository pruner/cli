import execa from "execa";
import io from "./io";
import parseGitDiff from 'git-diff-parser';
import { chain } from "lodash";
import { State } from "./providers";

const declarations = {
    isGitProject,
    getGitVersion,
    getGitTopDirectory,
    getCurrentDiffText,
    getChangedFiles,
    createStashCommit
};

async function runGitCommand(...args: string[]) {
    const result = await execa("git", args, {
        reject: false
    });
    if(result.exitCode !== 0)
        return "";

    return result.stdout?.trim() ?? "";
}

async function isGitProject() {
    return !!await declarations.getGitVersion();
}

async function getGitVersion() {
    return await runGitCommand("--version");
}

async function getGitTopDirectory() {
    const path = await runGitCommand("rev-parse", "--show-toplevel");
    if(!path)
        return path;

    return io.normalizePathSeparators(path);
}

async function getCurrentDiffText(fromCommit: string, toCommit: string) {
    if(fromCommit && toCommit)
        return await runGitCommand("diff", fromCommit, toCommit);

    return await runGitCommand("diff");
}

async function getChangedFiles(fromCommit: string, toCommit: string) {
    const diffText = await declarations.getCurrentDiffText(fromCommit, toCommit);
    const gitDiff = parseGitDiff(diffText);

    const changedLines = chain(gitDiff.commits)
        .flatMap(x => x.files)
        .map(getLineChangesForFile)
        .filter(x => !!x.filePath)
        .value();

    console.debug("git-diff-text", diffText);
    console.debug("git-diff-original", chain(gitDiff.commits).flatMap(x => x.files).flatMap(x => x.lines).value());
    console.debug("git-diff-lines", changedLines);

    return changedLines;
}

async function createStashCommit() {
    return await runGitCommand("stash", "create");
}

function getLineChangesForFile(file: parseGitDiff.File) {
    const getLines = (type: (line: parseGitDiff.Line) => boolean) => chain(file.lines)
        .filter(type)
        .value();

    return {
        addedLines: getLines(line => line.type === "added").map(x => x.ln1),
        deletedLines: getLines(line => line.type === "deleted").map(x => x.ln1),
        unchangedLines: getLines(x => x.type === "normal").map(x => ({
            oldLine: x.ln1,
            newLine: x.ln2
        })),
        filePath: io.normalizePathSeparators(file.name)
    };
}

export default declarations;
