import * as ora from "ora";
import { writeToPrunerFile } from "./io";
import {Provider} from "./providers";
import { useSpinner } from "./utils";

export async function run(provider: Provider<any>) {
    await useSpinner("Running tests", async () => {
        const result = await provider.run();
        if(result.exitCode !== 0) {
            console.error("Could not run tests.\n" + result.stdout + "\n" + result.stderr);
            return;
        }
        
        const state = await provider.gatherState();
        await writeToPrunerFile(`${provider.name}.json`, JSON.stringify(state, null, ' '));
    });
}