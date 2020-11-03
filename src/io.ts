
import { glob as internalGlob } from 'glob';
import { lstat, mkdir, readdir, readFile, writeFile } from "fs/promises";
import { basename, dirname, join, sep } from 'path';

export async function glob(workingDirectory: string, pattern: string): Promise<string[]> {
    return new Promise(resolve => 
        internalGlob(
            pattern, 
            {
                cwd: workingDirectory
            }, 
            (_, matches) => resolve(matches)));
}

export async function safeStat(path: string) {
    try {
        const stat = await lstat(path);
        return stat;
    } catch(ex) {
        return null;
    }
}

export async function writeToFile(path: string, contents: string) {
    await ensurePathExists(path);
    await writeFile(path, contents);
}

export async function readFromFile(path: string) {
    await ensurePathExists(path);

    try {
        const result = await readFile(path);
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
            await mkdir(folderPath, {
                recursive: true
            });
        }
    }
}

export async function getPrunerPath() {
    let currentPath = process.cwd();
    while(currentPath.indexOf(sep) > -1) {
        const directories = await readdir(currentPath);
        if(!!directories.find(x => basename(x) === ".pruner"))
            return join(currentPath, ".pruner");

        currentPath = dirname(currentPath);
    }

    return "";
}

export async function writeToPrunerFile(path: string, contents: string) {
    const prunerDirectory = await getPrunerPath();
    await writeToFile(join(prunerDirectory, path), contents);
}

export async function readFromPrunerFile(path: string) {
    const prunerDirectory = await getPrunerPath();
    return await readFromFile(join(prunerDirectory, path));
}