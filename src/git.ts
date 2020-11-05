import execa from "execa";
import io from "./io";

const declarations = {
    isGitProject,
    getGitVersion,
    getGitTopDirectory,
    getCurrentDiffText
};

async function runGitCommand(...args: string[]) {
    const result = await execa("git", args, {
        reject: false
    });
    if(result.exitCode !== 0)
        throw result;

    return result.stdout;
}

async function isGitProject() {
    return !!await getGitVersion();
}

async function getGitVersion() {
    return await runGitCommand("--version");
}

async function getGitTopDirectory() {
    return io.normalizePathSeparators(await runGitCommand("rev-parse", "--show-toplevel"));
}

async function getCurrentDiffText() {
    const result = await runGitCommand("diff");
    return result;
}

export default declarations;