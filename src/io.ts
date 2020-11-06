
import { glob as internalGlob } from 'glob';
import fs from "fs";
import { basename, dirname, join, sep } from 'path';
import rimraf from 'rimraf';

const exported = {
    glob,
    safeStat,
    writeToFile,
    readFromFile,
    getPrunerPath,
    writeToPrunerFile,
    readFromPrunerFile,
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

async function safeStat(path: string) {
    try {
        const stat = await fs.promises.lstat(path);
        return stat;
    } catch(ex) {
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
    } catch(ex) {
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

async function getPrunerPath() {
    let currentPath = process.cwd();
    while(true) {
        const directories = await fs.promises.readdir(currentPath);
        if(!!directories.find(x => basename(x) === ".pruner"))
            return normalizePathSeparators(join(currentPath, ".pruner"));

        currentPath = dirname(currentPath);
        if(currentPath.indexOf(sep) === -1 || currentPath.lastIndexOf(sep) === currentPath.length - 1)
            break;
    }

    return "";
}

async function writeToPrunerFile(path: string, contents: string) {
    const prunerDirectory = await exported.getPrunerPath();
    await writeToFile(join(prunerDirectory, path), contents);
}

async function readFromPrunerFile(path: string) {
    const prunerDirectory = await exported.getPrunerPath();
    return await readFromFile(join(prunerDirectory, path));
}

async function removeDirectory(path: string) {
    return new Promise(resolve => rimraf(path, null, resolve));
}

function normalizePathSeparators(path: string) {
    if(!path)
        return "";

    path = path.replace(/\\/g, "/");
    while(path.indexOf("//") > -1)
        path = path.replace("//", "/");

    return path;
}

export default exported;