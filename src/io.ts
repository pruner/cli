
import { glob as internalGlob } from 'glob';
import { lstat, mkdir, readdir, writeFile } from "fs/promises";
import { basename, dirname, join } from 'path';

export async function glob(workingDirectory: string, pattern: string): Promise<string[]> {
    return new Promise(resolve => 
        internalGlob(
            pattern, 
            {
                cwd: workingDirectory
            }, 
            (_, matches) => resolve(matches)));
}

export async function doesPathExist(path: string) {
    const stat = await lstat(path);
    return stat.isFile() || stat.isDirectory();
}

export async function writeToFile(path: string, contents: string) {
    const fileStat = await lstat(path);
    if(!fileStat.isFile()) {
        const folderPath = dirname(path);
        const folderStat = await lstat(folderPath);
        if(!folderStat.isDirectory()) {
            await mkdir(folderPath, {
                recursive: true
            });
        }
    }

    await writeFile(path, contents);
}

export async function getPrunerPath() {
    let currentPath = process.cwd();

    let isFound = false;
    while(!isFound) {
        const directories = await readdir(currentPath);
        isFound = !!directories.find(x => basename(x) === ".pruner");

        currentPath = dirname(currentPath);
    }

    return null;
}

export async function writeToPrunerFile(path: string, contents: string) {
    const prunerDirectory = await getPrunerPath();
    await writeToFile(join(prunerDirectory, path), contents);
}