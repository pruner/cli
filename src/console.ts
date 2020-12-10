import ora from 'ora';
import prompts from 'prompts';

const declarations = {
	useSpinner,
	ask,
	applyVerbosityLevel
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

type Verbosity = "normal" | "verbose";

type LogSettings = {
	verbosity: Verbosity;
}

const logSettings: LogSettings = {
	verbosity: "normal"
};
function applyVerbosityLevel(level: Verbosity) {
	logSettings.verbosity = level;

	if (level !== 'verbose')
		console.debug = () => { };
}

export const LogSettings = logSettings;
export default declarations;