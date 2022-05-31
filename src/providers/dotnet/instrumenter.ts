import io from "../../io";
import pruner from "../../pruner";
import { join } from 'path';
import con, { LogSettings } from "../../console";
import download from "download";
import { node } from "execa";
import extract from "extract-zip";

export async function downloadInstrumenter(cwd: string, settingsId: string) {
	const existingInstrumenterPath = join(
		cwd,
		await getInstrumenterExecutablePath(settingsId));
	con.debug(() => ["existing-instrumenter", cwd, existingInstrumenterPath]);

	const existingInstrumenterFileStat = await io.safeStat(existingInstrumenterPath);
	if (existingInstrumenterFileStat?.isFile())
		return;

	const path = join(
		cwd,
		await getInstrumenterDirectoryPath(settingsId));
	con.debug(() => ["downloading-instrumenter", path]);

	const zipFileName = "Pruner.Instrumenter.zip";
	await download(`https://github.com/pruner/dotnet/releases/download/latest/${zipFileName}`, path);
	await extract(
		join(path, zipFileName),
		{ dir: path });
}

export async function runInstrumenter(cwd: string, settingsId: string, command: string) {
	const instrumenterPath = await getInstrumenterExecutablePath(settingsId);
	con.debug(() => ["running instrumenter", cwd, instrumenterPath, settingsId, command]);

	await con.execaPiped(
		"dotnet",
		[
			instrumenterPath,
			settingsId,
			command
		],
		{
			cwd,
			reject: true
		},
		LogSettings.verbosity === "verbose" ?
			["stderr", "stdout"] :
			["stderr"]);
}

async function getInstrumenterExecutablePath(settingsId: string) {
	const directoryPath = await getInstrumenterDirectoryPath(settingsId);
	await io.ensurePathExists(directoryPath);

	return join(
		directoryPath,
		"Pruner.Instrumenter.dll");
}

async function getInstrumenterDirectoryPath(settingsId: string) {
	return join(
		".pruner",
		"temp",
		settingsId,
		"instrumenter");
}