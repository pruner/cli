import execa from "execa";
import { Provider, ProviderSettings, ProviderState, ProviderType, SettingsQuestions, TestsByAffectedState } from "../types";

export type MochaSettings = ProviderSettings;

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
		throw new Error();
	}

	public async gatherState(): Promise<ProviderState> {
		throw new Error();
	}
}