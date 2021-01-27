import { gray, red, white, yellow } from 'chalk';
import { promises } from 'fs';
import _, { chain, join, orderBy, range, sumBy } from 'lodash';
import minimatch from 'minimatch';
import con from '../console';
import { io, pruner } from '../exports';
import { allProviderClasses, createProvidersFromIdOrNameOrType } from '../providers/factories';
import { Provider, ProviderSettings } from '../providers/types';
import { Command, DefaultArgs } from './Command';

type Args = DefaultArgs & {
	provider?: string,
	"total-chunks": number,
	"chunk-offset": number,
	"glob-pattern": string,
	"by": "automatic" | "timings" | "file-count"
};

export default {
	command: 'split [provider] <total-chunks> <chunk-offset> <glob-pattern>',
	describe: 'Splits test-files in <total-chunks> parts, and leaves only the chunk at <chunk-offset> on the disk.',
	builder: yargs => yargs
		.positional('provider', {
			choices: allProviderClasses.map(x => x.providerType),
			demandOption: false,
		})
		.positional('total-chunks', {
			demandOption: true,
			type: "number"
		})
		.positional('chunk-offset', {
			demandOption: true,
			type: "number"
		})
		.positional('glob-pattern', {
			demandOption: true,
			type: "string"
		})
		.option('by', {
			demandOption: false,
			choices: ["automatic", "timings", "file-count"],
			default: "automatic",
			type: "string"
		}),
	handler,
} as Command<Args>;

type FileDuration = {
	path: string;
	duration: number;
}

export async function handler(args: Args) {
	con.applyVerbosityLevel(args.verbosity);

	const allTestFiles = await getAllTestFilesMatchingGlob(args);
	if (allTestFiles === null)
		return;

	if (allTestFiles.length === 0)
		return console.error(red("No files matching the glob pattern were found."));

	con.debug(() => ["all-test-files", allTestFiles]);

	const filesByDurationDescending = orderBy(allTestFiles, x => x.duration, "desc");

	const totalChunks = args['total-chunks'];
	const chunks = range(0, totalChunks).map(() => new Array<FileDuration>());

	for (let file of filesByDurationDescending) {
		const smallestChunk = chain(chunks)
			.orderBy(x => sumBy(x, f => f.duration))
			.first()
			.value();
		smallestChunk.push(file);
	}

	const chunkOffset = args["chunk-offset"];
	const matchingChunk = chunks[chunkOffset];

	console.log(gray("Generating chunk containing the following tests:"));
	for (let file of matchingChunk) {
		console.log(gray(` - ${file.path}`));
	}

	await Promise.all(chain(chunks)
		.filter((_, i) => i !== chunkOffset)
		.flatMap(x => x)
		.map(x => promises.unlink(x.path))
		.value());
}

async function getAllTestFilesMatchingGlob(args: Args): Promise<FileDuration[]> {
	const providers = await createProvidersFromIdOrNameOrType(args.provider);
	if (providers.length === 0 && (args.by === "timings" || args.provider)) {
		console.warn(red(`Pruner has not been initialized yet with ${white("pruner init")}.`));
		return null;
	}

	if (args.by === "timings" || args.by === "automatic") {
		const allStates = await Promise.all(providers.map(async p => ({
			workingDirectory: p.settings.workingDirectory,
			state: await pruner.readState(p.settings.id)
		})));
		const result = chain(allStates)
			.filter(x => !!x)
			.flatMap(x => x.state.tests.map(t => ({
				test: t,
				workingDirectory: x.workingDirectory
			})))
			.flatMap(x => x.test.fileCoverage.map(f => ({
				filePath: join(x.workingDirectory, f.path),
				duration: x.test.duration
			})))
			.filter(x => minimatch(
				x.filePath,
				args['glob-pattern']))
			.groupBy(x => x.filePath)
			.map(x => ({
				path: x[0].filePath,
				duration: sumBy(x, p => p.duration)
			}))
			.value();
		if (args.by === "timings") {
			if (result.length === 0) {
				console.error(red(`No timing data was found. Are you sure you have committed your Pruner state files in GIT?`));
				console.error(red("Alternatively, consider splitting by file count."));
				return null;
			}

			return result;
		}

		if (args.by === "automatic" && result.length > 0)
			return result;
	}

	if (args.by === "automatic") {
		console.warn(yellow(`Pruner has not been initialized yet with ${white("pruner init")}.`));
		console.warn(yellow(`This means that the glob pattern will apply to all files in the current directory, and not just test files in the given provider.`));
		console.warn(yellow(`It also means that the test splits are not based on timing data, but instead are split equally based on file count.`));
	}

	const files = await io.glob(process.cwd(), args['glob-pattern']);
	return files.map(f => ({
		path: f,
		duration: 1
	}));
}