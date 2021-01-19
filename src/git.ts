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
	isFileInGitIgnore,
	getGitIgnoreContentsForPath
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

async function getGitIgnoreContentsForPath(path: string) {
	let currentPath = dirname(path);

	const gitIgnoreLines = new Array<string>();
	while (true) {
		const gitIgnoreContents = await io.globContents(".gitignore", {
			workingDirectory: currentPath
		});
		con.debug(() => ["git-ignore-contents", currentPath, gitIgnoreContents]);

		const gitIgnore = gitIgnoreContents && gitIgnoreContents[0];
		if (gitIgnore) {
			const lines = gitIgnore
				.replace(/\r/g, "")
				.split('\n');
			gitIgnoreLines.push(...chain(lines)
				.map(x => x.trim())
				.filter(x => !!x)
				.filter(x => x.substr(0, 1) !== '#')
				.flatMap(p => [
					join(currentPath, p)
				])
				.flatMap(p => (p.startsWith("/") || p.startsWith("\\")) ?
					"**" + p :
					[p, join("**", p)])
				.flatMap(p => (p.endsWith("/") || p.endsWith("\\")) ?
					p + "**" :
					[p, join(p, "**")])
				.map(x => x.replace(/\\/g, "/"))
				.value());
		}

		if (currentPath === ".")
			break;

		currentPath = dirname(currentPath);
	}

	return gitIgnoreLines;
}

async function isFileInGitIgnore(path: string) {
	const gitIgnoreLines = await declarations.getGitIgnoreContentsForPath(path);
	const isInIgnore = !!gitIgnoreLines.find(line => minimatch(path, line));
	con.debug(() => ['is-file-in-gitignore result', path, gitIgnoreLines, isInIgnore]);
	return isInIgnore;
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
