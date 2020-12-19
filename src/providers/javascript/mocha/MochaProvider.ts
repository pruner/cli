import { yellow } from "chalk";
import execa from "execa";
import _, { chain } from "lodash";
import { keys } from "lodash";
import { join, resolve } from "path";
import con from "../../../console";
import { io, pruner } from "../../../exports";
import git from "../../../git";
import { Provider, ProviderSettings, ProviderState, ProviderType, SettingsQuestions, StateFile, StateLineCoverage, StateTest, TestsByAffectedState } from "../../types";
import { IstanbulCoverageRoot } from "../istanbul.types";
import regexEscape from 'regex-escape';

export type MochaSettings = ProviderSettings;

export const compiledMochaReporterFilePath = resolve(join(__dirname, "..", "..", "..", "..", "dist", "providers", "javascript", "mocha", "reporter.js"));
export default class MochaProvider implements Provider<MochaSettings> {
	public get settings() {
		return this._settings;
	}

	public static get providerType(): ProviderType {
		return "mocha";
	}

	constructor(private readonly _settings: MochaSettings) {
		console.debug("mocha-init", _settings);
	}

	public getGlobPatterns() {
		return [
			"**/*.js",
			"**/*.ts"
		];
	}

	public static getInitQuestions(): SettingsQuestions<MochaSettings> {
		return {
			workingDirectory: {
				type: "text",
				message: "What relative directory would you like to run 'mocha' from?",
			}
		};
	}

	public async executeTestProcess(
		tests: TestsByAffectedState
	): Promise<execa.ExecaReturnValue<string>> {
		const affectedFilter = tests.affected
			.map(x => `(?:^${regexEscape(x.name)}$)`)
			.join("|");

		const unknownFilter = tests.unaffected
			.map(x => `(?:^(?!${regexEscape(x.name)}$).*)`)
			.join("");

		const filterArgument = [affectedFilter, unknownFilter].join("|");

		const cwd = resolve(join(
			await git.getGitTopDirectory(),
			this.settings.workingDirectory));

		console.log("filter", affectedFilter);

		return await con.execaPiped("nyc", ["--reporter", "none", "mocha", "--reporter", compiledMochaReporterFilePath, "--grep", filterArgument], {
			cwd,
			reject: false
		});
	}

	public async gatherState(): Promise<ProviderState> {
		const coverageRootJson = await pruner.readFromTempFile("mocha.json");
		if (!coverageRootJson) {
			console.warn(yellow(`The Mocha Pruner reporter did not report any coverage.`));
			return null;
		}

		const gitTopDirectory = await git.getGitTopDirectory();

		const coverageRoot = JSON.parse(coverageRootJson) as IstanbulCoverageRoot;

		const allFiles = new Array<StateFile>();
		const allLineCoverage = new Array<StateLineCoverage>();
		const allTests = new Array<StateTest>();

		const testNames = keys(coverageRoot);
		for (let testName of testNames) {
			let test = allTests.find(x => x.name === testName);
			if (!test) {
				test = {
					name: testName,
					id: allTests.length,
					duration: null,
					failure: null
				};
				allTests.push(test);
			}

			const testData = coverageRoot[testName];
			const fileNames = keys(testData);
			for (let fileName of fileNames) {
				const normalizedFileName = io
					.normalizePathSeparators(fileName)
					.substr(resolve(gitTopDirectory).length + 1);

				const fileTestData = testData[fileName];

				const statementMap = fileTestData.statementMap;
				const statementCoverage = fileTestData.s;

				const coveredLineNumbers = chain(statementMap)
					.keys()
					.filter(x =>
						typeof statementCoverage[x] === "number" &&
						statementCoverage[x] > 0)
					.map(x => statementMap[x])
					.flatMap(x => [
						x.start.line - 1,
						x.end.line - 1
					])
					.uniq()
					.value();
				if (coveredLineNumbers.length === 0)
					continue;

				let file = allFiles.find(x => x.path === normalizedFileName);
				if (!file) {
					file = {
						path: normalizedFileName,
						id: allFiles.length
					};
					allFiles.push(file);
				}

				for (let coveredLineNumber of coveredLineNumbers) {
					let lineCoverage = allLineCoverage.find(x =>
						x.fileId === file.id &&
						x.lineNumber === coveredLineNumber);
					if (!lineCoverage) {
						lineCoverage = {
							fileId: file.id,
							lineNumber: coveredLineNumber,
							testIds: []
						};
						allLineCoverage.push(lineCoverage);
					}

					lineCoverage.testIds.push(test.id);
				}
			}
		}

		return {
			coverage: allLineCoverage,
			files: allFiles,
			tests: allTests
		};
	}
}