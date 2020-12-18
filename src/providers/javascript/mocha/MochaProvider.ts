import execa from "execa";
import { join, resolve } from "path";
import con from "../../../console";
import git from "../../../git";
import { Provider, ProviderSettings, ProviderState, ProviderType, SettingsQuestions, TestsByAffectedState } from "../../types";

export type MochaSettings = ProviderSettings;

export const compiledMochaReporterFilePath = resolve(join(__dirname, "..", "..", "..", "dist", "providers", "javascript", "mocha", "reporter.js"));
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
		const cwd = resolve(join(
			await git.getGitTopDirectory(),
			this.settings.workingDirectory));

		return await con.execaPiped("nyc", ["--reporter", "none", `mocha --reporter ${compiledMochaReporterFilePath}`], {
			cwd,
			reject: false
		});
	}

	public async gatherState(): Promise<ProviderState> {
		return {
			coverage: [],
			files: [],
			tests: []
		};
	}
}