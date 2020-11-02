import { ExecaChildProcess } from "execa";

export default interface Provider<TState> {
    name: string;

    run(previousState?: TState): Promise<ExecaChildProcess>;
    gatherState(): Promise<TState>;
}