import { parseStringPromise } from "xml2js";
import execa from "execa";
import io from "../../io";
import { AltCoverRoot } from "./altcover.types";
import git from "../../git";
import con from "../../console";
import { yellow, yellowBright } from "chalk";
import { getAltCoverArguments, getLoggerArguments, getPropertyArguments, getRunSettingArguments, getVerbosityArguments } from "./arguments";
import { ProviderSettings, Provider, SettingsQuestions, TestsByAffectedState, ProviderState, ProviderType } from "../types";
import { TrxRoot } from "./trx.types";
import { getFilter } from "./filter";
import { makeRunSettingsFile } from "./runsettings";
import { join, resolve } from "path";
import { LogSettings } from "../../console";
import { parseFiles, parseLineCoverage, parseModules, parseTests } from "./parsing";

export type DotNetSettings = ProviderSettings & {
	environment: {
		[property: string]: any
	},
	properties: {
		[propertyName: string]: any
	},
	mstest: {
		categories: string[];
	},
	nunit: {
		categories: string[];
	},
};

const coverageXmlFileName = "coverage.xml.tmp.pruner";
const summaryFileName = "summary.trx.tmp.pruner";

export default class DotNetProvider implements Provider<DotNetSettings> {
	public get settings() {
		return this._settings;
	}

	public static get providerType(): ProviderType {
		return "dotnet";
	}

	constructor(private readonly _settings: DotNetSettings) {
		con.debug(() => ["dotnet-init", _settings]);
	}

	public static getInitQuestions(): SettingsQuestions<DotNetSettings> {
		return {
			workingDirectory: {
				type: "text",
				message: "What relative directory would you like to run 'dotnet test' from?",
			},
			mstest: null,
			nunit: null,
			environment: null,
			properties: null
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
			...getLoggerArguments(summaryFileName),
			...getVerbosityArguments(),
			...await getPropertyArguments(this.settings.id, this.settings.properties)
		];
		con.debug(() => ["execute-settings", this.settings]);
		con.debug(() => ["execute-args", args.join(' ')]);

		const cwd = resolve(join(
			await git.getGitTopDirectory(),
			this.settings.workingDirectory));

		const result = await con.execaPiped("dotnet", ["test", ...args], {
			cwd,
			reject: false
		});

		return result;
	}

	public async gatherState(): Promise<ProviderState> {
		const altCoverXmlAsJson: AltCoverRoot[] = await this.globContentsFromXmlToJson(`**/${coverageXmlFileName}`);
		if (altCoverXmlAsJson.length === 0) {
			console.warn(yellow(`Could not find any coverage data from AltCover recursively within ${yellowBright(this.settings.workingDirectory)}.`));
			console.warn(yellow(`Make sure AltCover is installed in your test projects.`));
			console.warn(yellow('Setup instructions: https://github.com/pruner/cli/blob/main/docs/dotnet.md'));
			return null;
		}

		const summaryFileContents: TrxRoot[] = await this.globContentsFromXmlToJson(`**/${summaryFileName}`);

		const modules = parseModules(altCoverXmlAsJson);

		const projectRootDirectory = await git.getGitTopDirectory();
		const files = parseFiles(modules, projectRootDirectory);
		const tests = parseTests(modules, summaryFileContents);
		const coverage = parseLineCoverage(modules);

		return {
			tests: tests,
			files: files,
			coverage: coverage,
		};
	}

	private async globContentsFromXmlToJson(glob: string) {
		const projectRootDirectory = await git.getGitTopDirectory();
		const coverageFileContents = await io.globContents(glob, {
			workingDirectory: resolve(join(projectRootDirectory, this.settings.workingDirectory)),
			deleteAfterRead: LogSettings.verbosity !== "verbose"
		});
		return await Promise.all(
			coverageFileContents.map((file) => parseStringPromise(file, {
				async: true,
			})));
	}
}
