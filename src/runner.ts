import * as ora from "ora";
import Provider from "./Provider";
import { writeToFile } from "./utils";

export async function run(provider: Provider<any>) {
    await useSpinner("Running tests", async () => {
        const result = await provider.run();
        if(result.exitCode !== 0) {
            console.error("Could not run tests.\n" + result.stdout + "\n" + result.stderr);
            return;
        }
        
        const state = await provider.gatherState();
    });
}

async function useSpinner<T>(text: string, callback: () => Promise<T>) {
    const spinner = ora(text);
    spinner.start();

    try {
        return await callback();
    } finally {
        spinner.stop();
    }
}