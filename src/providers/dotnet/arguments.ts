import _ from "lodash";
import { dirname, join } from "path";
import { LogSettings } from "../../console";
import { pruner } from "../../exports";
import { DotNetSettings } from "./DotNetProvider";

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

export function getRunSettingArguments(runSettingFilePath: string) {
	return [
		"--settings",
		runSettingFilePath
	];
}

export async function getOutputArguments(providerId: string) {
	const temporaryPath = await pruner.writeToTempFile(join(providerId, "build", ".gitignore"), "**");
	return [
		"--output",
		dirname(temporaryPath)
	];
}

export function getPropertyArguments(properties: DotNetSettings["properties"]) {
	if (!properties)
		return [];

	const keys = _.keys(properties);
	return keys.map(k => `/p:${k}=${properties[k]}`);
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
