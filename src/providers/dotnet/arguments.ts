import _ from "lodash";
import { join } from "path";
import { LogSettings } from "../../console";
import { git, io } from "../../exports";
import { TestsByAffectedState } from "../types";
import { DotNetSettings } from "./DotNetProvider";
import { getFilter } from "./filter";
import { makeRunSettingsFile } from "./runsettings";

export async function getRunSettingArguments(settings: DotNetSettings, tests: TestsByAffectedState) {
	const filter = getFilter(tests, settings);
	const runSettingsFilePath = await makeRunSettingsFile(settings, filter);
	return [
		"--settings",
		runSettingsFilePath
	];
}

export function getTestArguments() {
	return [
		"--no-build"
	];
}

export async function getBuildArguments(settings: DotNetSettings, prunerBinDirectory: string) {
	const keys = _.keys(settings.properties || {});
	const propertyArguments = keys.map(k => `/p:${k}=${settings.properties[k]}`);

	return [
		...propertyArguments,
		`--no-incremental`,
		`--nologo`,
		`/p:GenerateTargetFrameworkAttribute=False`,
		`/p:GenerateAssemblyInfo=False`,
		...getOutputArguments(prunerBinDirectory)
	];
}

export function getOutputArguments(prunerBinDirectory: string) {
	return [
		`--output`,
		join(prunerBinDirectory, "bin")
	];
}

export async function getPrunerBinDirectory(settings: DotNetSettings) {
	const topDirectory = await git.getGitTopDirectory();
	const temporaryDirectoryPath = join(topDirectory, settings.workingDirectory, ".pruner-bin");
	return temporaryDirectoryPath;
}

export function getVerbosityArguments() {
	return [
		"--verbosity",
		LogSettings.verbosity === "verbose" ?
			"normal" :
			"minimal"
	];
}

export function getLoggerArguments(reportName: string) {
	return [
		"--logger",
		`trx;LogFileName=../${reportName}`,
		"--logger",
		"console;verbosity=detailed"
	];
}
