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
    getChangedFileLines
};

async function runGitCommand(...args: string[]) {
    const result = await execa("git", args, {
        reject: false
    });
    if(result.exitCode !== 0)
        return "";

    return result.stdout;
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

async function getCurrentDiffText() {
    const result = await runGitCommand("diff");
    return result;
}

async function getChangedFileLines() {
    const diffText = await declarations.getCurrentDiffText();
    const gitDiff = parseGitDiff(diffText);

    const changedLines = chain(gitDiff.commits)
        .flatMap(x => x.files)
        .map(getLineChangesForFile)
        .filter(x => !!x.filePath && x.changedLines.length > 0)
        .value();

    console.debug("git-diff-text", diffText);
    console.debug("git-diff-lines", changedLines);

    return changedLines;
}

function getLineChangesForFile(file: parseGitDiff.File) {
    const getLines = (type: (line: parseGitDiff.Line) => boolean) => chain(file.lines)
        .filter(type)
        .map(x => x.ln2 || x.ln1)
        .filter(y => !!y)
        .uniq()
        .value();

    const lines = getLines(line => 
        line.type === "added" ||
        line.type === "deleted");

    return {
        changedLines: lines,
        filePath: io.normalizePathSeparators(file.name)
    };
}

export default declarations;
