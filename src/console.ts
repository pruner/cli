import ora = require('ora');

export async function useSpinner<T>(text: string, callback: () => Promise<T>) {
    const spinner = ora(text);
    spinner.start();

    try {
        return await callback();
    } finally {
        spinner.stop();
    }
}