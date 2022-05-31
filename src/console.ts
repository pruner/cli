import { gray } from 'chalk';
import execa, { Options } from 'execa';
import ora from 'ora';
import prompts from 'prompts';

const declarations = {
	useSpinner,
	ask,
	applyVerbosityLevel,
	execaPiped,
	debug
};

function debug(valueAccessor: () => object[] | object) {
	if (LogSettings.verbosity !== "verbose")
		return;

	let returnValue = valueAccessor();
	if (!Array.isArray(returnValue))
		returnValue = [returnValue];

	console.debug(...(returnValue as object[]));
}

async function execaPiped(
	file: string,
	args?: string[],
	options?: Options,
	pipes?: Array<"stdout" | "stderr">
) {
	const result = execa(file, args, options);

	function trimTrailingWhitespace(text: string) {
		if (text.endsWith("\n"))
			return text.substr(0, text.lastIndexOf("\n"));

		return text;
	}

	const events = {
		stdout: (buffer: Buffer) => console.log(gray(trimTrailingWhitespace(buffer.toString()))),
		stderr: (buffer: Buffer) => console.error(gray(trimTrailingWhitespace(buffer.toString())))
	};

	debug(() => ["executing", file, args, options, pipes]);

	const allPipes = ["stdout", "stderr"];
	const pipesToListen = LogSettings.verbosity === "verbose" ?
		allPipes :
		(pipes || allPipes);
	for (let pipe of pipesToListen)
		result[pipe].on("data", events[pipe]);

	try {
		return await result;
	} finally {
		for (let pipe of pipesToListen)
			result[pipe].off("data", events[pipe]);
	}
}

async function useSpinner<T>(text: string, callback: () => Promise<T>) {
	const methodsToProxy: Array<keyof typeof console> = [
		"log",
		"debug",
		"info",
		"trace",
		"error",
		"warn"
	];

	const oldMethods: { [name: string]: any } = {};

	const spinner = ora(text);
	try {
		spinner.start();

		for (let method of methodsToProxy) {
			oldMethods[method] = global.console[method];
			global.console[method] = <any>((...args: any[]) => {
				spinner.stop();
				oldMethods[method](...args);
				spinner.start(text);
			});
		}

		return await callback();
	} finally {
		spinner.stop();

		for (let methodToProxy of methodsToProxy) {
			global.console[methodToProxy] = oldMethods[methodToProxy];
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