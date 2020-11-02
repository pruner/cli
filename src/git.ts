import * as execa from "execa";

async function runGitCommand(...args: string[]) {
    const result = await execa("git", args);
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
    return await runGitCommand("rev-parse", "--show-toplevel");
}