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
        return "";

    return result.stdout;
}

async function isGitProject() {
    return !!await getGitVersion();
}

async function getGitVersion() {
    return await runGitCommand("--version");
}

async function getGitTopDirectory() {
    const path = await runGitCommand("rev-parse", "--show-toplevel");
    if(!path)
        return path;

    return io.normalizePathSeparators(path);
}

async function getCurrentDiffText() {
    const result = await runGitCommand("diff");
    return result;
}

export default declarations;