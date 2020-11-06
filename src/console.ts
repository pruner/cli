import ora from 'ora';
import prompts from 'prompts';

const declarations = {
    useSpinner,
    ask
};

async function useSpinner<T>(text: string, callback: () => Promise<T>) {
    const spinner = ora(text);
    spinner.start();

    try {
        return await callback();
    } finally {
        spinner.stop();
    }
}

async function ask(questions: prompts.PromptObject<string>[]) {
    return await prompts(questions);
}

export default declarations;