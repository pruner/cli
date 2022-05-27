import { parse } from "fast-xml-parser";
import execa from "execa";
import io from "../../io";
import git from "../../git";
import con from "../../console";
import { getLoggerArguments, getBuildArguments, getRunSettingArguments, getTestArguments, getVerbosityArguments, getOutputArguments } from "./arguments";
import { ProviderSettings, Provider, SettingsQuestions, TestsByAffectedState, ProviderState, ProviderType } from "../types";
import { TrxRoot } from "./trx.types";
import { join, resolve } from "path";
import { LogSettings } from "../../console";
import { parseTrxSummary } from "./parsing";
import { measureTime } from "../../time";
import { downloadInstrumenter, runInstrumenter } from "./instrumenter";
import pruner from "../../pruner";

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

		const cwd = resolve(join(
			await git.getGitTopDirectory(),
			this.settings.workingDirectory));

		const instrumenterDownloadPromise = downloadInstrumenter(cwd, this.settings.id);

		await con.execaPiped(
			"dotnet",
			[
				"build",
				...await getBuildArguments(this.settings)
			],
			{
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
			...await getOutputArguments(this.settings)
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
		const state: ProviderState = JSON.parse(
			await pruner.readFromTempFile(
				join(
					this.settings.id,
					"state.json")));

		if (state?.tests) {
			const summaryFileContents: TrxRoot[] = await measureTime("gatherState-summaryFileContents", async () =>
				await this.globContentsFromXmlToJson(`**/${summaryFileName}`));

			const trxSummaryTests = await measureTime("gatherState-tests", async () =>
				await parseTrxSummary(
					summaryFileContents));
			for (let trxSummaryTest of trxSummaryTests) {
				const matchingTest = state.tests.find(test => test.name === trxSummaryTest.name);
				if (!matchingTest)
					throw new Error("Test not found in state: " + trxSummaryTest.name);

				matchingTest.duration = trxSummaryTest.duration;
				matchingTest.failure = trxSummaryTest.failure;
			}
		}

		return state;
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
