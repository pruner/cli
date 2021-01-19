import _ from "lodash";
import { dirname, join, sep } from "path";
import { LogSettings } from "../../console";
import { git, io, pruner } from "../../exports";
import { ProviderSettings, TestsByAffectedState } from "../types";
import { DotNetSettings } from "./DotNetProvider";
import { getFilter } from "./filter";
import { makeRunSettingsFile } from "./runsettings";

export function getCallContextArgument() {
	const attributes = [
		"TestMethod",
		"Test",
		"Fact",
		"Theory"
	];

	const callContextArgument = attributes
		.map(attribute => `[${attribute}]`)
		.join('|');
	return callContextArgument;
}

export function getAltCoverArguments(reportName: string) {
	const callContextArgument = getCallContextArgument();
	return [
		"/p:AltCover=true",
		"/p:AltCoverSingle=true",
		"/p:AltCoverLineCover=true",
		"/p:AltCoverVisibleBranches=true",
		"/p:AltCoverSourceLink=false",
		`/p:AltCoverCallContext=${callContextArgument}`,
		"/p:AltCoverForce=false",
		`/p:AltCoverXmlReport=${reportName}`,
		"/p:AltCoverSummaryFormat=N",
		"/p:AltCoverLocalSource=true",
		`/p:AltCoverVerbosity=${LogSettings.verbosity === "verbose" ?
			"Info" :
			"Warning"}`
	];
}

export async function getRunSettingArguments(settings: DotNetSettings, tests: TestsByAffectedState) {
	const filter = getFilter(tests, settings);
	const runSettingsFilePath = await makeRunSettingsFile(settings, filter);
	return [
		"--settings",
		runSettingsFilePath
	];
}

export async function getPropertyArguments(settings: DotNetSettings) {
	const keys = _.keys(settings.properties || {});
	const propertyArguments = keys.map(k => `/p:${k}=${settings.properties[k]}`);

	const topDirectory = await git.getGitTopDirectory();
	const temporaryDirectoryPath = join(topDirectory, settings.workingDirectory, ".pruner-bin");

	await io.writeToFile(
		join(temporaryDirectoryPath, ".gitignore"),
		"**");

	return [
		...propertyArguments,
		`/p:GenerateTargetFrameworkAttribute=False`,
		`/p:GenerateAssemblyInfo=False`,
		`--output`,
		`${join(temporaryDirectoryPath, "bin")} `
	];
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
