import { parseStringPromise } from "xml2js";
import execa from "execa";
import io from "../../io";
import { ModuleModule, AltCoverRoot } from "./altcover";
import { chain, range } from "lodash";
import git from "../../git";
import { yellow, yellowBright } from "chalk";
import { getAltCoverArguments, getLoggerArguments, getRunSettingArguments } from "./arguments";
import { ProviderSettings, Provider, SettingsQuestions, TestsByAffectedState, ProviderState, ProviderType } from "../types";
import { TrxRoot } from "./trx";
import { getFilter } from "./filter";
import { makeRunSettingsFile } from "./runsettings";

export type DotNetSettings = ProviderSettings & {
	environment: {
		[property: string]: any
	};
	mstest: {
		categories: string[];
	};
	nunit: {
		categories: string[];
	};
};

const coverageXmlFileName = "coverage.xml.tmp.pruner";
const summaryFileName = "summary.trx.tmp.pruner";

export default class DotNetProvider implements Provider<DotNetSettings> {
	public get settings() {
		return this._settings;
	}

	constructor(private readonly _settings: DotNetSettings) {
		console.debug("dotnet-init", _settings);
	}

	public static get providerType(): ProviderType {
		return "dotnet";
	}

	public static getInitQuestions(): SettingsQuestions<DotNetSettings> {
		return {
			workingDirectory: {
				type: "text",
				message: "What relative directory would you like to run 'dotnet test' from?",
			},
			mstest: null,
			nunit: null,
			environment: null
		};
	}

	public getGlobPatterns() {
		return ["**/*.cs"];
	}

	public async executeTestProcess(
		tests: TestsByAffectedState
	): Promise<execa.ExecaReturnValue<string>> {

		const filter = getFilter(tests, this.settings);

		const runSettingsFilePath = await makeRunSettingsFile(this.settings, filter);

		const args = [
			...getRunSettingArguments(runSettingsFilePath),
			...getAltCoverArguments(coverageXmlFileName),
			...getLoggerArguments(summaryFileName)
		];
		console.debug("execute-settings", this.settings);
		console.debug("execute-args", args);

		const result = await execa("dotnet", ["test", ...args], {
			cwd: this.settings.workingDirectory,
			reject: false,
		});
		if (typeof result.exitCode === "undefined")
			console.warn(yellow("It could look like you don't have the .NET Core SDK installed, required for the .NET provider."));

		return result;
	}

	public async gatherState(): Promise<ProviderState> {
		const projectRootDirectory = await git.getGitTopDirectory();

		const altCoverXmlAsJson: AltCoverRoot[] = await this.globContentsFromXmlToJson(`**/${coverageXmlFileName}`);
		if (altCoverXmlAsJson.length === 0) {
			console.warn(yellow(`Could not find any coverage data from AltCover recursively within ${yellowBright(this.settings.workingDirectory)}. Make sure AltCover is installed in your test projects.`));
			return null;
		}

		const summaryFileContents: TrxRoot[] = await this.globContentsFromXmlToJson(`**/${summaryFileName}`);

		const modules = this.parseModules(altCoverXmlAsJson);

		const files = this.parseFiles(modules, projectRootDirectory);
		const tests = this.parseTests(modules, summaryFileContents);
		const coverage = this.parseLineCoverage(modules);

		return {
			tests: tests,
			files: files,
			coverage: coverage,
		};
	}

	private async globContentsFromXmlToJson(glob: string) {
		const coverageFileContents = await io.globContents(glob, {
			workingDirectory: this.settings.workingDirectory,
			deleteAfterRead: true
		});
		return await Promise.all(
			coverageFileContents.map((file) => parseStringPromise(file, {
				async: true,
			})));
	}

	private parseModules(altCoverXmlAsJson: AltCoverRoot[]) {
		return chain(altCoverXmlAsJson)
			.map((x) => x.CoverageSession)
			.flatMap((x) => x.Modules)
			.flatMap((x) => x.Module)
			.filter((x) => !!x)
			.value();
	}

	private parseFiles(modules: ModuleModule[], projectRootDirectory: string) {
		return chain(modules)
			.flatMap((x) => x.Files)
			.flatMap((x) => x.File)
			.map((x) => x?.$)
			.filter((x) => !!x)
			.map((x) => ({
				id: +x.uid,
				path: io.normalizePathSeparators(x.fullPath),
			}))
			.filter((x) => x.path.startsWith(projectRootDirectory))
			.map((x) => ({
				...x,
				path: this.sanitizeStatePath(projectRootDirectory, x.path),
			}))
			.value();
	}

	private parseTests(
		altCoverModules: ModuleModule[],
		trxSummary: TrxRoot[]
	) {
		const testRuns = trxSummary.map(x => x.TestRun);
		const testDefinitions = chain(testRuns)
			.flatMap(x => x.TestDefinitions)
			.flatMap(x => x?.UnitTest)
			.filter(x => !!x)
			.flatMap(x => x
				.TestMethod
				.map(t => ({
					id: x.$.id,
					name: `${t.$.className}.${t.$.name}`
				})))
			.value();
		const testResults = chain(testRuns)
			.flatMap(x => x.Results)
			.flatMap(x => x?.UnitTestResult)
			.filter(x => !!x)
			.map(x => x.$)
			.map(x => ({
				...testDefinitions.find(t => t.id === x.testId),
				passed: x.outcome === "Passed",
				duration: x.duration
			}))
			.value();

		console.debug("test-results", testResults);

		return chain(altCoverModules)
			.flatMap(x => x.TrackedMethods)
			.flatMap(x => x.TrackedMethod)
			.map(x => x?.$)
			.filter(x => !!x)
			.map(x => ({
				passed: true,
				...testResults.find(t => t.name === this.sanitizeMethodName(x.name)),
				name: this.sanitizeMethodName(x.name),
				id: +x.uid
			}))
			.value();
	}

	private parseLineCoverage(modules: ModuleModule[]) {
		return chain(modules)
			.flatMap((x) => x.Classes)
			.flatMap((x) => x.Class)
			.filter((x) => !!x)
			.flatMap((x) => x.Methods)
			.flatMap((x) => x.Method)
			.filter((x) => !!x)
			.flatMap((x) => x.SequencePoints)
			.flatMap((x) => x.SequencePoint)
			.filter((x) => !!x)
			.flatMap((x) => range(+x.$.sl, +x.$.el + 1).map((l) => ({
				testIds: chain(x.TrackedMethodRefs || [])
					.flatMap((m) => m.TrackedMethodRef)
					.map((m) => m?.$)
					.filter((m) => !!m)
					.map((m) => +m.uid)
					.value(),
				fileId: +x?.$.fileid,
				lineNumber: l,
			})))
			.filter((x) =>
				!!x.fileId &&
				x.testIds.length > 0)
			.value();
	}

	private sanitizeStatePath(projectRootDirectory: string, path: string): string {
		path = path.substring(projectRootDirectory.length + 1);
		return path;
	}

	private sanitizeMethodName(name: string) {
		const typeSplit = name.split(" ");

		const namespaceAndName = typeSplit[1].replace(/::/g, ".");

		return namespaceAndName.substr(0, namespaceAndName.indexOf("("));
	}
}
