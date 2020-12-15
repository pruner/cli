import { ExecaReturnValue } from "execa";
import prompts from "prompts";

export type SettingsQuestions<TSettings> = TSettings extends ProviderSettings & { [key: string]: any; } ?
	{
		[TKey in keyof Omit<TSettings, "excludeFromWatch" | "id" | "name" | "type">]: Omit<prompts.PromptObject<TSettings[TKey]>, "name">;
	}
	: never;

export type StateTest = {
	name: string;
	id: number;
	duration: string;
	failure: {
		stdout?: string[];
		message?: string;
		stackTrace?: string[];
	}
};

export type StateLineCoverage = {
	lineNumber: number;
	fileId: number;
	testIds: number[];
};

export type ProviderState = {
	tests: StateTest[];
	files: {
		id: number;
		path: string;
	}[];
	coverage: StateLineCoverage[];
};

export type ProviderSettings = {
	id: string;
	type: ProviderType;
	name: string;
	workingDirectory: string;
	excludeFromWatch: boolean;
};

export interface Provider<TSettings extends ProviderSettings = ProviderSettings> {
	settings: TSettings;

	getGlobPatterns(): string[];
	executeTestProcess(tests: TestsByAffectedState): Promise<ExecaReturnValue<string>>;
	gatherState(): Promise<ProviderState>;
}

export type ProviderType = "dotnet";

export type ProviderClass<TSettings extends ProviderSettings = ProviderSettings> = {
	providerType: ProviderType;

	new(settings: TSettings): Provider<TSettings>;

	getInitQuestions(): SettingsQuestions<TSettings>;
};

export type TestsByAffectedState = {
	affected: StateTest[];
	unaffected: StateTest[];
};