import { ExecaReturnValue } from "execa";
import prompts from "prompts";

export type SettingsQuestions<TSettings> = TSettings extends {
    [key: string]: any;
}
    ? {
        [TKey in keyof TSettings]: Omit<
            prompts.PromptObject<TSettings[TKey]>,
            "name"
        >;
    }
    : never;

export type StateTest = {
    name: string;
    id: number;
};

export type StateLineCoverage = {
    lineNumber: number;
    fileId: number;
    testIds: number[];
};

export type State = {
    commitId?: string;
    tests: StateTest[];
    files: {
        id: number;
        path: string;
    }[];
    coverage: StateLineCoverage[];
};

export type ProviderSettings = {
    workingDirectory: string;
    excludeFromWatch: boolean;
};

export interface Provider<TSettings extends ProviderSettings = ProviderSettings> {
    settings: TSettings;

    getGlobPatterns(): string[];
    executeTestProcess(tests: TestsByAffectedState): Promise<ExecaReturnValue<string>>;
    gatherState(): Promise<State>;
}

export type ProviderClass<TSettings extends ProviderSettings = ProviderSettings> = {
    providerName: string;

    new(settings: TSettings): Provider<TSettings>;

    getInitQuestions(): SettingsQuestions<TSettings>;
};

export type TestsByAffectedState = {
    affected: StateTest[];
    unaffected: StateTest[];
};