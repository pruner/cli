import { ExecaChildProcess, ExecaReturnValue } from "execa";
import * as prompts from "prompts";
import DotNetProvider from "./dotnet/DotNetProvider";

export type ChangedFiles = Array<{
    lineNumbers: number[],
    name: string
}>;

export type SettingsQuestions<TSettings> = TSettings extends {[key: string]: any} ? 
    {
        [TKey in keyof TSettings]: Omit<prompts.PromptObject<TSettings[TKey]>, "name">;
    } :
    never;

export interface Provider<TState> {
    executeTestProcess(previousState: TState, changedFiles: ChangedFiles): Promise<ExecaReturnValue<string>>;
    gatherState(): Promise<TState>;
    mergeState(previousState: TState, newState: TState): Promise<TState>;
}

export type ProviderClass<TState, TSettings> = {
    providerName: string;

    new(settings: TSettings): Provider<TState>;
    
    getInitQuestions(): SettingsQuestions<TSettings>;
}

export const allProviders: ProviderClass<any, any>[] = [
    DotNetProvider
];