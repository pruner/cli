
import { glob as internalGlob } from 'glob';
import fs, { rm } from "fs";
import { basename, dirname, join, sep } from 'path';
import rimraf from 'rimraf';

const exported = {
    glob,
    globContents,
    safeStat,
    writeToFile,
    readFromFile,
    normalizePathSeparators,
    removeDirectory
};

async function glob(workingDirectory: string, pattern: string): Promise<string[]> {
    return new Promise(resolve =>
        internalGlob(
            pattern,
            {
                cwd: workingDirectory
            },
            (_, matches) => resolve(matches)));
}

async function globContents(globPattern: string, options?: {
    workingDirectory?: string,
    deleteAfterRead?: boolean
}) {
    const filePaths = await exported.glob(
        options?.workingDirectory,
        globPattern);

    console.debug("file-glob-results", options?.workingDirectory, globPattern, filePaths);

    const coverageFileBuffers = await Promise.all(filePaths
        .map(filePath => fs.promises.readFile(
            join(options?.workingDirectory, filePath))));

    const fileContents = coverageFileBuffers
        .map(file => file.toString());

    if (options?.deleteAfterRead) {
        await Promise.all(filePaths
            .map(filePath => fs.promises.unlink(
                join(options?.workingDirectory, filePath))));
    }

    return fileContents;
}

async function safeStat(path: string) {
    try {
        const stat = await fs.promises.lstat(path);
        return stat;
    } catch (ex) {
        return null;
    }
}

async function writeToFile(path: string, contents: string) {
    await ensurePathExists(path);
    await fs.promises.writeFile(path, contents);
}

async function readFromFile(path: string) {
    await ensurePathExists(path);

    try {
        const result = await fs.promises.readFile(path);
        return result.toString();
    } catch (ex) {
        return null;
    }
}

async function ensurePathExists(path: string) {
    const fileStat = await safeStat(path);
    if (!fileStat?.isFile()) {
        const folderPath = dirname(path);
        const folderStat = await safeStat(folderPath);
        if (!folderStat?.isDirectory()) {
            await fs.promises.mkdir(folderPath, {
                recursive: true
            });
        }
    }
}

async function removeDirectory(path: string) {
    return new Promise(resolve => {
        rimraf(path, resolve);
    });
}

function normalizePathSeparators(path: string) {
    if (!path)
        return "";

    path = path.replace(/\\/g, "/");
    while (path.indexOf("//") > -1)
        path = path.replace("//", "/");

    return path;
}

export default exported;