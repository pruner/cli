import { ExecaChildProcess, ExecaReturnValue } from "execa";
import DotNetProvider from "./dotnet/DotNetProvider";

export type ChangedFiles = Array<{
    lineNumbers: number[],
    name: string
}>;

export interface Provider<TState> {
    name: string;

    run(previousState: TState, changedFiles: ChangedFiles): Promise<ExecaReturnValue<string>>;
    gatherState(): Promise<TState>;
}

export const allProviders: Array<Provider<any>> = [
    new DotNetProvider(null, null)
];