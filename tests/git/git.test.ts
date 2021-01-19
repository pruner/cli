import { join } from "path";
import git from "../../src/git";
import io from "../../src/io";
import { gitDiff } from "../helpers/git";

let mockCurrentDiff: string;
git.getCurrentDiffText = async () => mockCurrentDiff ?? "";

describe("git", () => {
	const setDiffBetweenFiles = async (fromPath: string, toPath: string) => {
		mockCurrentDiff = await gitDiff(
			join(__dirname, fromPath),
			join(__dirname, toPath)
		);
	};

	const getFile = async () => {
		const files = await git.getChangedFiles();
		return files[0];
	};

	describe("transpositions", () => {
		test("added lines", async () => {
			await setDiffBetweenFiles("SomeClass.cs", "SomeClass.added.cs");

			const changedLines = await getFile();
			console.log(changedLines);
		});

		test("removed lines", async () => {
			await setDiffBetweenFiles("SomeClass.cs", "SomeClass.removed.cs");

			const changedLines = await getFile();
			console.log(changedLines);
		});
	});

	describe("gitignore", () => {

		describe("isFileInGitIgnore", () => {
			test("[Bb]in in root folder", async () => {
				io.globContents = async (_, settings) =>
					settings.workingDirectory === "." && ["[Bb]in"];

				expect(await git.isFileInGitIgnore("bin")).toBe(true);
			});
			test("[Bb]in in root folder capitalized", async () => {
				io.globContents = async (_, settings) =>
					settings.workingDirectory === "." && ["[Bb]in"];

				expect(await git.isFileInGitIgnore("Bin")).toBe(true);
			});

			test("[Bb]in in deepest folder", async () => {
				io.globContents = async (_, settings) =>
					settings.workingDirectory === "foo" && ["[Bb]in"];

				expect(await git.isFileInGitIgnore("foo/bin")).toBe(true);
			});

			test("[Bb]in in subfolder", async () => {
				io.globContents = async (_, settings) =>
					settings.workingDirectory === "foo" && ["[Bb]in"];

				expect(await git.isFileInGitIgnore("foo/bin/blah")).toBe(true);
			});
		});
	});
});
