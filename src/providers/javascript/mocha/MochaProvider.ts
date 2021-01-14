import { yellow } from "chalk";
import execa from "execa";
import { chain } from "lodash";
import { keys } from "lodash";
import { join, resolve } from "path";
import con, { LogSettings } from "../../../console";
import { io, pruner } from "../../../exports";
import git from "../../../git";
import { Provider, ProviderSettings, ProviderState, ProviderType, SettingsQuestions, StateFile, StateLineCoverage, StateTest, TestsByAffectedState } from "../../types";
import regexEscape from 'regex-escape';
import { MochaCoverageContext } from "./reporter";

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
		con.debug(() => ["mocha-init", _settings]);
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

		const filterArgument = [affectedFilter, unknownFilter]
			.filter(x => !!x)
			.join("|");

		const cwd = resolve(join(
			await git.getGitTopDirectory(),
			this.settings.workingDirectory));

		const nycReporter = LogSettings.verbosity === "verbose" ?
			"json" :
			"none";
		const result = await con.execaPiped("nyc", ["--reporter", nycReporter, "mocha", "--reporter", compiledMochaReporterFilePath, "--grep", filterArgument], {
			cwd,
			reject: false
		});

		return result;
	}

	public async gatherState(): Promise<ProviderState> {
		const coverageRootJson = await pruner.readFromTempFile("mocha.json");
		if (!coverageRootJson) {
			console.warn(yellow(`The Mocha Pruner reporter did not report any coverage.`));
			console.warn(yellow(`This might mean that the provider has not been set up correctly.`));
			console.warn(yellow('Setup instructions: https://github.com/pruner/cli/blob/main/docs/mocha.md'));
			return null;
		}

		const gitTopDirectory = await git.getGitTopDirectory();

		const coverageRoots = JSON.parse(coverageRootJson) as MochaCoverageContext[];

		const allFiles = new Array<StateFile>();
		const allLineCoverage = new Array<StateLineCoverage>();
		const allTests = new Array<StateTest>();

		for (let coverageRoot of coverageRoots) {
			const testNames = keys(coverageRoot.coverage);
			for (let testName of testNames) {
				const testData = coverageRoot.coverage[testName];

				let test = allTests.find(x => x.name === coverageRoot.name);
				if (!test) {
					test = {
						name: coverageRoot.name,
						id: `t${allTests.length}`,
						duration: coverageRoot.duration || null,
						failure: coverageRoot.state === "failed" ?
							{
								message: coverageRoot.error?.message,
								stackTrace: (coverageRoot.error && 'stack' in coverageRoot.error && coverageRoot.error['stack']) || null,
								stdout: null
							} : null
					};
					allTests.push(test);
				}

				const fileName = testData.path;

				const normalizedFileName = io
					.normalizePathSeparators(fileName)
					.substr(resolve(gitTopDirectory).length + 1);

				const statementMap = testData.statementMap;
				const statementCoverage = testData.s;

				const coveredLineNumbers = chain(statementMap)
					.keys()
					.filter(x =>
						typeof statementCoverage[x] === "number" &&
						statementCoverage[x] > 0)
					.map(x => statementMap[x])
					.flatMap(x => x.start.line)
					.uniq()
					.value();
				if (coveredLineNumbers.length === 0)
					continue;

				let file = allFiles.find(x => x.path === normalizedFileName);
				if (!file) {
					file = {
						path: normalizedFileName,
						id: `f${allFiles.length}`
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