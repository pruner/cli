import io from './io';
import git from './git';
import fs from 'fs';
import { basename, dirname, join, sep } from 'path';
import { ProviderSettings, ProviderState } from './providers/types';

const exported = {
    getPrunerPath,
    writeToFile: writeToFile,
    readFromFile: readFromFile,
    writeToTempFile: writeToTempFile,
    readFromTempFile: readFromTempFile,
    readState,
    persistState,
    readSettings,
    persistSettings,
    readGitState,
    persistGitState
};

async function getPrunerPath() {
    let currentPath = process.cwd();
    while (true) {
        const directories = await fs.promises.readdir(currentPath);
        if (!!directories.find(x => basename(x) === ".pruner"))
            return io.normalizePathSeparators(join(currentPath, ".pruner"));

        currentPath = dirname(currentPath);
        if (currentPath.indexOf(sep) === -1 || currentPath.lastIndexOf(sep) === currentPath.length - 1)
            break;
    }

    return "";
}

async function writeToFile(path: string, contents: string) {
	const prunerDirectory = await exported.getPrunerPath();
	
	const fullPath = join(prunerDirectory, path);
	await io.writeToFile(fullPath, contents);
	
	return fullPath;
}

async function readFromFile(path: string) {
    const prunerDirectory = await exported.getPrunerPath();
    return await io.readFromFile(join(prunerDirectory, path));
}

async function writeToTempFile(path: string, contents: string) {
    return await exported.writeToFile(
        join("temp", path),
        contents);
}

async function readFromTempFile(path: string) {
    return await exported.readFromFile(join("temp", path));
}

async function persistState(providerId: string, state: ProviderState) {
    const fileName = getStateFileName(providerId);
    await exported.writeToFile(
        fileName,
        JSON.stringify(state));
}

async function readState(providerId: string): Promise<ProviderState> {
    const fileName = getStateFileName(providerId);
    return JSON.parse(
        await exported.readFromFile(fileName));
}

async function persistSettings(settings: SettingsFile) {
    const fileName = getSettingsFileName();
    await exported.writeToFile(
        fileName,
        JSON.stringify(settings));
}

async function readSettings(): Promise<SettingsFile> {
    const fileName = getSettingsFileName();
    return JSON.parse(
        await exported.readFromFile(fileName));
}

async function readGitState() {
    const state: GitState = JSON.parse(await exported.readFromTempFile("git.json")) || {};

    const currentBranch = await git.getBranchName();
    if (currentBranch !== state.branch) {
        state.branch = currentBranch;
        state.commit = null;
    }

    return state;
}

async function persistGitState(commitId: string) {
    await exported.writeToTempFile("git.json", JSON.stringify({
        commit: commitId,
        branch: await git.getBranchName()
    } as GitState));
}

function getStateFileName(providerId: string) {
    return join('state', `${providerId}.json`);
}

function getSettingsFileName() {
    return "settings.json";
}

type GitState = {
    commit: string,
    branch: string
}

type SettingsFile = {
    providers: ProviderSettings[]
}

export default exported;