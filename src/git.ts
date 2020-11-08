import execa from "execa";
import io from "./io";
import parseGitDiff, { Line } from "git-diff-parser";
import { chain } from "lodash";

const declarations = {
  isGitProject,
  getGitVersion,
  getGitTopDirectory,
  getCurrentDiffText,
  getChangedFiles,
  createStashCommit,
};

async function runGitCommand(...args: string[]) {
  const result = await execa("git", args, {
    reject: false,
  });
  if (result.exitCode !== 0) return "";

  return result.stdout?.trim() ?? "";
}

async function isGitProject() {
  return !!(await declarations.getGitVersion());
}

async function getGitVersion() {
  return await runGitCommand("--version");
}

async function getGitTopDirectory() {
  const path = await runGitCommand("rev-parse", "--show-toplevel");
  if (!path) return path;

  return io.normalizePathSeparators(path);
}

async function getCurrentDiffText(fromCommit: string, toCommit: string) {
  if (fromCommit && toCommit)
    return await runGitCommand("diff", fromCommit, toCommit);

  return await runGitCommand("diff");
}

export type FileChanges = {
  added: number[];
  deleted: number[];
  unchanged: Array<{
    oldLineNumber: number;
    newLineNumber: number;
  }>;
  filePath: string;
};

async function getChangedFiles(fromCommit?: string, toCommit?: string): Promise<FileChanges[]> {
  const diffText = await declarations.getCurrentDiffText(fromCommit, toCommit);
  const gitDiff = parseGitDiff(diffText);

  const changedLines = chain(gitDiff.commits)
    .flatMap((x) => x.files)
    .map(getLineChangesForFile)
    .filter((x) => !!x.filePath)
    .value();

  return changedLines;
}

async function createStashCommit() {
  return await runGitCommand("stash", "create");
}

function getLineChangesForFile(file: parseGitDiff.File): FileChanges {
  const getLines = (type: (line: parseGitDiff.Line) => boolean) =>
    chain(file.lines).filter(type).value();

  return {
    added: getLines((line) => line.type === "added").map((x) => x.ln1),
    deleted: getLines((line) => line.type === "deleted").map((x) => x.ln1),
    unchanged: getLines((x) => x.type === "normal").map((x) => ({
      oldLineNumber: x.ln1,
      newLineNumber: x.ln2,
    })),
    filePath: io.normalizePathSeparators(file.name),
  };
}

export default declarations;
