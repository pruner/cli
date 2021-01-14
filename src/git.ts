import execa from "execa";
import io from "./io";
import con from "./console";
import parseGitDiff from "git-diff-parser";
import fs from 'fs';
import { chain } from "lodash";
import { basename, dirname, join, sep } from "path";
import minimatch from "minimatch";

const declarations = {
	isGitProject,
	getGitVersion,
	getGitTopDirectory,
	getCurrentDiffText,
	getChangedFiles,
	createStashCommit,
	getBranchName,
	hasInitialCommitBeenMade,
	isFileInGitIgnore
};

export type FileChanges = {
	added: number[];
	deleted: number[];
	unchanged: Array<{
		oldLineNumber: number;
		newLineNumber: number;
	}>;
	filePath: string;
};

export type CommitRange = {
	from: string,
	to: string
}

async function runGitCommand(...args: string[]) {
	const result = await execa("git", args, {
		reject: false,
	});
	if (result.exitCode !== 0)
		return "";

	return result.stdout?.trim() ?? "";
}

async function isGitProject() {
	return !!(await declarations.getGitVersion());
}

async function getGitVersion() {
	return await runGitCommand("--version");
}

async function getBranchName() {
	return await runGitCommand("rev-parse", "--abbrev-ref", "HEAD");
}

async function isFileInGitIgnore(path: string) {
	let currentPath = dirname(path);

	const gitIgnoreLines = new Array<string>();
	while (true) {
		const files = await fs.promises.readdir(currentPath);
		const gitIgnoreFile = files.find(x => basename(x) === ".gitignore");
		if (!!gitIgnoreFile) {
			const gitIgnorePath = join(currentPath, gitIgnoreFile);
			con.debug(() => ['is-file-in-gitignore detected', gitIgnorePath]);

			const contentsBuffer = await fs.promises.readFile(gitIgnorePath);
			const contents = contentsBuffer.toString();
			const lines = contents
				.replace(/\r/g, "")
				.split('\n');
			gitIgnoreLines.push(...chain(lines)
				.map(x => x.trim())
				.filter(x => !!x)
				.filter(x => x.substr(0, 1) !== '#')
				.map(p => join(
					currentPath,
					p))
				.flatMap(p => p.endsWith(sep) ?
					p + "**" :
					[p, join(p, sep, "**")])
				.value());
		}

		currentPath = dirname(currentPath);
		if (currentPath.indexOf(sep) === -1 || currentPath.lastIndexOf(sep) === currentPath.length - 1)
			break;
	}

	con.debug(() => ['is-file-in-gitignore result', path, gitIgnoreLines]);
	return !!gitIgnoreLines.find(line => minimatch(path, line));
}

async function getGitTopDirectory() {
	const path = await runGitCommand("rev-parse", "--show-toplevel");
	con.debug(() => ['git-top-directory', path]);

	if (!path)
		return path;

	return io.normalizePathSeparators(path);
}

async function hasInitialCommitBeenMade() {
	const output = await runGitCommand("rev-parse", "HEAD");
	return !!output;
}

async function getCurrentDiffText(commitRange?: CommitRange) {
	const { from, to } = commitRange || {};
	if (from && to)
		return await runGitCommand("diff", from, to);

	return await runGitCommand("diff");
}

async function getChangedFiles(commitRange?: CommitRange): Promise<FileChanges[]> {
	const diffText = await declarations.getCurrentDiffText(commitRange);
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
