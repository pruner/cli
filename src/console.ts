import { gray, red } from 'chalk';
import execa, { Options } from 'execa';
import ora from 'ora';
import prompts from 'prompts';

const declarations = {
	useSpinner,
	ask,
	applyVerbosityLevel,
	execaPiped
};

async function execaPiped(
	file: string,
	args?: string[],
	options?: Options
) {
	const result = execa(file, args, options);

	const onStdout = (buffer: Buffer) => console.log(gray(buffer.toString()));
	const onStderr = (buffer: Buffer) => console.error(red(buffer.toString()))
	result.stdout.on('data', onStdout);
	result.stderr.on('data', onStderr);

	try {
		return await result;
	} finally {
		result.stdout.off('data', onStdout);
		result.stderr.off('data', onStderr);
	}
}

async function useSpinner<T>(text: string, callback: () => Promise<T>) {
	const spinner = ora(text);
	spinner.start();

	const methodsToProxy: Array<keyof typeof console> = [
		"log",
		"debug",
		"info",
		"trace",
		"warn"
	];

	const oldMethods: { [name: string]: any } = {};

	for (let method of methodsToProxy) {
		oldMethods[method] = global.console[method];
		global.console[method] = <any>((...args: any[]) => {
			spinner.stop();
			oldMethods[method](...args);
			spinner.start(text);
		});
	}

	try {
		return await callback();
	} finally {
		spinner.stop();

		for (let method of methodsToProxy) {
			global.console[method] = oldMethods[method];
		}
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