import git from '../../src/git';
import { gitDiff } from '../helpers/git';

let mockCurrentDiff = "";
git.getCurrentDiffText = async () => mockCurrentDiff;

describe("git", () => {
    const setDiffBetweenFiles = async (fromPath: string, toPath: string) => {
        mockCurrentDiff = await gitDiff(
            toPath, 
            fromPath);
    };

    const getFile = async () => {
        const files = await git.getChangedFileLines();
        return files[0];
    }

    describe("transpositions", () => {
        test("added lines", async () => {
            await setDiffBetweenFiles("SomeClass.cs", "SomeClass.added.cs");

            const changedLines = await getFile();
            console.log(changedLines);
        });
    });
});