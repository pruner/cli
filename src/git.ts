import execa from "execa";
import { normalizePathSeparators } from "./io";

async function runGitCommand(...args: string[]) {
    const result = await execa("git", args, {
        reject: false
    });
    if(result.exitCode !== 0)
        throw result;

    return result.stdout;
}

export async function isGitProject() {
    return !!await getGitVersion();
}

export async function getGitVersion() {
    return await runGitCommand("--version");
}

export async function getGitTopDirectory() {
    return normalizePathSeparators(await runGitCommand("rev-parse", "--show-toplevel"));
}

export async function getCurrentDiffText() {
    throw new Error("NOPE!");

    const result = await runGitCommand("diff");
    return result;
}