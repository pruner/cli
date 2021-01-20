import { throttle } from 'lodash';
import { gray, red, white, yellow } from 'chalk';
import { Command, DefaultArgs } from '../Command';
import chokidar from 'chokidar';
import pruner from '../../pruner';
import con from '../../console';
import { allProviderClasses, createProvidersFromProvider as createProvidersFromIdOrNameOrType } from '../../providers/factories';
import { Provider } from '../../providers/types';
import { join } from 'path';
import { runTestsForProviders } from './tests';
import { git } from '../../exports';

export type Args = DefaultArgs & {
	provider?: string;
	watch?: boolean;
	all?: boolean;
};

export default {
	command: 'run [provider]',
	describe: 'Run tests.',
	builder: yargs => yargs
		.positional('provider', {
			choices: allProviderClasses.map(x => x.providerType),
			demandOption: false,
			type: 'string',
			describe: 'The provider to run tests for. If not specified, runs all tests.'
		})
		.option('watch', {
			alias: 'w',
			type: 'boolean',
			demandOption: false,
			describe: 'Launches in watch mode (run tests as files change).'
		})
		.option('all', {
			alias: 'a',
			type: 'boolean',
			demandOption: false,
			describe: 'Run all tests instead of affected tests.'
		}),
	handler
} as Command<Args>;

export async function handler(args: Args) {
	con.applyVerbosityLevel(args.verbosity);

	const prunerDirectory = await pruner.getPrunerPath();
	if (!prunerDirectory) {
		console.error(red('Pruner has not been initialized for this project.'));
		console.log(`Run ${white('pruner init')}.`);
		return;
	}

	const providers = await createProvidersFromIdOrNameOrType(args.provider);

	if (args.watch) {
		if (args.verbosity !== "verbose")
			await runTestsForProviders(providers, args);

		for (const provider of providers)
			watchProvider(provider, args);

		return [];
	} else {
		return await runTestsForProviders(providers, args);
	}
}

function watchProvider(provider: Provider, args: Args) {
	if (provider.settings.excludeFromWatch) {
		console.log(yellow("A provider was excluded from watch due to the 'excludeFromWatch' setting."));
		return;
	}

	let isRunning = false;
	let hasPending = false;

	const runTests = async () => {
		return await runTestsForProviders([provider], args);
	};

	const onFilesChanged = throttle(async (path: string) => {
		const isFileInGitIgnore = await git.isFileInGitIgnore(path);
		con.debug(() => ["file-changed", path, isFileInGitIgnore]);

		if (isFileInGitIgnore)
			return;

		console.log(gray(path + " changed."));
		console.log();

		if (isRunning) {
			hasPending = true;
			console.log(yellow('Changes have been detected during the current test run. A new test run has been scheduled after the current one is complete.'));
			console.log();
			return;
		}

		isRunning = true;

		try {
			await runTests();

			while (hasPending) {
				console.log(yellow('Changes were detected during the previous test run. A new test run will be started to include the most recent changes.'));

				hasPending = false;
				await runTests();
			}

			console.log(gray('Waiting for further file changes...'));
		} finally {
			isRunning = false;
		}
	}, 1000, {
		leading: false,
		trailing: true
	});

	const paths = provider
		.getGlobPatterns()
		.map(x => join(provider.settings.workingDirectory, x));

	const watcher = chokidar.watch(paths, {
		atomic: 1000,
		ignorePermissionErrors: true,
		useFsEvents: true,
		persistent: true,
		awaitWriteFinish: true,
		alwaysStat: true
	});
	watcher.on('ready', () => {
		watcher.on('change', onFilesChanged);
		watcher.on('add', onFilesChanged);
		watcher.on('unlink', onFilesChanged);
		watcher.on('addDir', onFilesChanged);
		watcher.on('unlinkDir', onFilesChanged);
	});
}