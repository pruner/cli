import { parse } from "fast-xml-parser";
import execa from "execa";
import io from "../../io";
import { AltCoverRoot } from "./altcover.types";
import git from "../../git";
import con from "../../console";
import { yellow, yellowBright } from "chalk";
import { getLoggerArguments, getPropertyArguments, getRunSettingArguments, getTestArguments, getVerbosityArguments } from "./arguments";
import { ProviderSettings, Provider, SettingsQuestions, TestsByAffectedState, ProviderState, ProviderType } from "../types";
import { TrxRoot } from "./trx.types";
import { join, resolve } from "path";
import { LogSettings } from "../../console";
import { parseModules, parseTests } from "./parsing";
import { measureTime } from "../../time";
import { downloadInstrumenter, runInstrumenter } from "./instrumenter";

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
		con.debug(() => ["execute-settings", this.settings]);

		const instrumenterDownloadPromise = downloadInstrumenter();

		const cwd = resolve(join(
			await git.getGitTopDirectory(),
			this.settings.workingDirectory));

		await con.execaPiped("dotnet", ["build"], {
			cwd,
			reject: false
		});

		await instrumenterDownloadPromise;

		await runInstrumenter(cwd, this.settings.id, "Instrument");

		const dotnetTestArgs = [
			...await getRunSettingArguments(this.settings, tests),
			...getLoggerArguments(summaryFileName),
			...getVerbosityArguments(),
			...getTestArguments(),
			...await getPropertyArguments(this.settings)
		];
		con.debug(() => ["execute-args", dotnetTestArgs.join(' ')]);
		const result = await con.execaPiped("dotnet", ["test", ...dotnetTestArgs], {
			cwd,
			reject: false
		});

		await runInstrumenter(cwd, this.settings.id, "Collect");

		return result;
	}

	public async gatherState(): Promise<ProviderState> {
		const altCoverXmlAsJson: AltCoverRoot[] = await measureTime("gatherState-altCoverXmlAsJson", async () =>
			await this.globContentsFromXmlToJson(`**/${coverageXmlFileName}`));
		if (altCoverXmlAsJson.length === 0) {
			console.warn(yellow(`Could not find any coverage data from AltCover recursively within ${yellowBright(this.settings.workingDirectory)}.`));
			console.warn(yellow(`Make sure AltCover is installed in your test projects.`));
			console.warn(yellow('Setup instructions: https://github.com/pruner/cli/blob/main/docs/dotnet.md'));
			return null;
		}

		const summaryFileContents: TrxRoot[] = await measureTime("gatherState-summaryFileContents", async () =>
			await this.globContentsFromXmlToJson(`**/${summaryFileName}`));

		const modules = await measureTime("gatherState-modules", () =>
			parseModules(altCoverXmlAsJson));

		const tests = await measureTime("gatherState-tests", async () =>
			await parseTests(
				modules,
				summaryFileContents));

		return {
			tests: tests
		};
	}

	private async globContentsFromXmlToJson(glob: string) {
		const projectRootDirectory = await git.getGitTopDirectory();
		const coverageFileContents = await io.globContents(glob, {
			workingDirectory: resolve(join(projectRootDirectory, this.settings.workingDirectory)),
			deleteAfterRead: LogSettings.verbosity !== "verbose"
		});
		return await Promise.all(
			coverageFileContents.map((file) => {
				const result = parse(file, {
					ignoreAttributes: false,
					arrayMode: true
				});
				return result;
			}));
	}
}
