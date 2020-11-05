import { ExecaReturnValue } from "execa";
import prompts from "prompts";
import DotNetProvider from "./dotnet/DotNetProvider";

export type SettingsQuestions<TSettings> = TSettings extends {[key: string]: any} ? 
    {
        [TKey in keyof TSettings]: Omit<prompts.PromptObject<TSettings[TKey]>, "name">;
    } :
    never;

export type Test = {
    name: string;
    id: number;
}

export type LineCoverage = {
    testIds: number[];
    fileId: number;
    lineNumber: number;
};

export type State = {
    tests: Test[];
    files: {
        id: number;
        path: string;
    }[];
    coverage: LineCoverage[];
};

export type Settings = {
    workingDirectory: string
};

export interface Provider {
    getGlobPatterns(): string[];
    executeTestProcess(tests: Tests): Promise<ExecaReturnValue<string>>;
    gatherState(): Promise<State>;
}

export type ProviderClass<TSettings> = {
    providerName: string;

    new(settings: TSettings): Provider;
    
    getInitQuestions(): SettingsQuestions<TSettings>;
}

export const allProviders: ProviderClass<any>[] = [
    DotNetProvider
];

export type Tests = {
    affected: Test[],
    unaffected: Test[]
}