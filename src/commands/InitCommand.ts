import { join } from 'path';
import chalk from 'chalk';
import prompts from 'prompts';
import _ from 'lodash';
import { allProviderClasses } from '../providers/factories';
import io from '../io';
import pruner from '../pruner';
import git from '../git';
import con from '../console';
import { v4 as guid } from 'uuid';
import { Command, DefaultArgs } from './Command';
import { ProviderClass, ProviderSettings } from '../providers/types';

type Args = DefaultArgs & {
	provider: string;
};

export default {
	command: 'init <provider>',
	describe: 'Set up Pruner for this project.',
	builder: yargs => yargs.positional('provider', {
		choices: allProviderClasses.map(x => x.providerType),
		demandOption: true,
	}),
	handler,
} as Command<Args>;

export async function handler(args: Args) {
	if (args.verbosity !== 'verbose')
		console.debug = () => { };

	const topDirectoryPath = await git.getGitTopDirectory();
	if (!topDirectoryPath) {
		console.error('Pruner requires that the current directory is in GIT.');
		return;
	}

	await io.writeToFile(
		join(topDirectoryPath, ".pruner", '.gitignore'),
		['temp/'].join('\n'));

	const Provider = allProviderClasses.find(x => x.providerType === args.provider);

	const settingsFile = await pruner.readSettings() || {
		providers: []
	};

	const provider = await createProviderFromClass(Provider);
	settingsFile.providers.push(provider);

	await pruner.persistSettings(settingsFile);

	console.log(chalk.green('Pruner has been initialized!'));
}

async function createProviderFromClass(Provider: ProviderClass<any>) {
	const provider = await constructProviderSettingsFromInitQuestions(Provider);
	provider.id = guid();
	provider.type = Provider.providerType;

	return provider;
}

async function constructProviderSettingsFromInitQuestions(Provider: ProviderClass) {
	const initQuestions = Provider.getInitQuestions();
	const keys = _.keys(initQuestions);
	for (const key of keys) {
		const section = initQuestions[key];
		if (section)
			section['name'] = key;
	}

	const questions = _.values(initQuestions)
		.filter(x => !!x) as prompts.PromptObject<any>[];
	return con.ask(questions) as any as ProviderSettings;
}
