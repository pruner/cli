import execa from "execa";

export async function gitDiff(path1: string, path2: string) {
    const result = await execa("git", [
        "diff",
        "--no-index",
        path1,
        path2
    ], {
        reject: false
    });
    return result.stdout;
}