import { ExecaChildProcess, ExecaReturnValue } from "execa";
import DotNetProvider from "./dotnet/DotNetProvider";

export interface Provider<TState> {
    name: string;

    run(previousState?: TState): Promise<ExecaReturnValue<string>>;
    gatherState(): Promise<TState>;
}

export const allProviders: Array<Provider<any>> = [
    new DotNetProvider(null, null)
];