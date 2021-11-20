import io from "../../io";
import pruner from "../../pruner";
import { join } from 'path';
import con from "../../console";
import download from "download";

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

	await download(
		"https://github.com/pruner/dotnet/releases/download/latest/Pruner.Instrumenter.exe",
		path);
}

export async function runInstrumenter(cwd: string, settingsId: string, command: string) {
	const instrumenterPath = await getInstrumenterExecutablePath(settingsId);
	con.debug(() => ["running instrumenter", cwd, instrumenterPath, settingsId, command]);

	await con.execaPiped(
		instrumenterPath,
		[
			settingsId,
			command
		],
		{
			cwd,
			reject: true
		},
		["stderr"]);
}

async function getInstrumenterExecutablePath(settingsId: string) {
	const directoryPath = await getInstrumenterDirectoryPath(settingsId);
	await io.ensurePathExists(directoryPath);

	return join(
		directoryPath,
		"Pruner.Instrumenter.exe");
}

async function getInstrumenterDirectoryPath(settingsId: string) {
	return join(
		".pruner",
		"temp",
		settingsId);
}