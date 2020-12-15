import { parseStringPromise } from "xml2js";
import execa from "execa";
import io from "../../io";
import { AltCoverRoot } from "./altcover";
import git from "../../git";
import con from "../../console";
import { yellow, yellowBright } from "chalk";
import { getAltCoverArguments, getLoggerArguments, getRunSettingArguments, getVerbosityArguments } from "./arguments";
import { ProviderSettings, Provider, SettingsQuestions, TestsByAffectedState, ProviderState, ProviderType } from "../types";
import { TrxRoot } from "./trx";
import { getFilter } from "./filter";
import { makeRunSettingsFile } from "./runsettings";
import { join, resolve } from "path";
import { LogSettings } from "../../console";
import { parseFiles, parseLineCoverage, parseModules, parseTests } from "./parsing";

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
			...getLoggerArguments(summaryFileName),
			...getVerbosityArguments()
		];
		console.debug("execute-settings", this.settings);
		console.debug("execute-args", args);

		const cwd = resolve(join(
			await git.getGitTopDirectory(),
			this.settings.workingDirectory));

		const result = await con.execaPiped("dotnet", ["test", ...args], {
			cwd,
			reject: false,
		});

		return result;
	}

	public async gatherState(): Promise<ProviderState> {
		const altCoverXmlAsJson: AltCoverRoot[] = await this.globContentsFromXmlToJson(`**/${coverageXmlFileName}`);
		if (altCoverXmlAsJson.length === 0) {
			console.warn(yellow(`Could not find any coverage data from AltCover recursively within ${yellowBright(this.settings.workingDirectory)}. Make sure AltCover is installed in your test projects.`));
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
