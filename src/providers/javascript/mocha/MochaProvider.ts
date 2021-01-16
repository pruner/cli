import { yellow } from "chalk";
import execa from "execa";
import { chain } from "lodash";
import { keys } from "lodash";
import { join, resolve } from "path";
import con, { LogSettings } from "../../../console";
import { io, pruner } from "../../../exports";
import git from "../../../git";
import { Provider, ProviderSettings, ProviderState, ProviderType, SettingsQuestions, StateFileCoverage, StateTest, TestsByAffectedState } from "../../types";
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

		const tests = new Array<StateTest>();

		for (let coverageRoot of coverageRoots) {
			const testNames = keys(coverageRoot.coverage);
			for (let testName of testNames) {
				const testData = coverageRoot.coverage[testName];

				let test = tests.find(x => x.name === coverageRoot.name);
				if (!test) {
					test = {
						name: coverageRoot.name,
						fileCoverage: [],
						duration: null,
						failure: null
					};
					tests.push(test);
				}

				test.duration = coverageRoot.duration || null;
				test.failure = coverageRoot.state === "failed" ?
					{
						message: coverageRoot.error?.message,
						stackTrace: (coverageRoot.error && 'stack' in coverageRoot.error && coverageRoot.error['stack']) || null,
						stdout: null
					} : null;

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

				let file = test.fileCoverage.find(x => x.path === normalizedFileName);
				if (!file) {
					file = {
						path: normalizedFileName,
						lineCoverage: []
					};
					test.fileCoverage.push(file);
				}

				for (let coveredLineNumber of coveredLineNumbers) {
					let lineCoverage = file.lineCoverage.find(x => x === coveredLineNumber);
					if (!lineCoverage) {
						file.lineCoverage.push(coveredLineNumber);
					}
				}
			}
		}

		return {
			tests: tests
		};
	}
}