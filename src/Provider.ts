import { ExecaChildProcess, ExecaReturnValue } from "execa";

export default interface Provider<TState> {
    name: string;

    run(previousState?: TState): Promise<ExecaReturnValue<string>>;
    gatherState(): Promise<TState>;
}