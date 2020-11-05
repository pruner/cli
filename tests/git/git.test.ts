// import { join } from 'path';
// import git from '../../src/git';
// import { gitDiff } from '../helpers/git';

// let mockCurrentDiff: string;
// git.getCurrentDiffText = async () => mockCurrentDiff ?? "";

test("empty", () => {});

// describe("git", () => {
//     const setDiffBetweenFiles = async (fromPath: string, toPath: string) => {
//         mockCurrentDiff = await gitDiff(
//             join(__dirname, fromPath), 
//             join(__dirname, toPath));
//     };

//     const getFile = async () => {
//         const files = await git.getChangedFiles();
//         return files[0];
//     }

//     describe("transpositions", () => {
//         test("added lines", async () => {
//             await setDiffBetweenFiles("SomeClass.cs", "SomeClass.added.cs");

//             const changedLines = await getFile();
//             console.log(changedLines);
//         });

//         test("removed lines", async () => {
//             await setDiffBetweenFiles("SomeClass.cs", "SomeClass.removed.cs");

//             const changedLines = await getFile();
//             console.log(changedLines);
//         });
//     });
// });