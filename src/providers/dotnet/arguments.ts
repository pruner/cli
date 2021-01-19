import _ from "lodash";
import { dirname, join, sep } from "path";
import { LogSettings } from "../../console";
import { io, pruner } from "../../exports";
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

export function getRunSettingArguments(runSettingFilePath: string) {
	return [
		"--settings",
		runSettingFilePath
	];
}

export async function getPropertyArguments(providerId: string, properties: DotNetSettings["properties"]) {
	const temporaryFilePath = await pruner.writeToTempFile(join(providerId, "build", ".gitignore"), "**");
	const temporaryDirectoryPath = join(dirname(temporaryFilePath), "bin");

	const keys = _.keys(properties || {});
	const propertyArguments = keys.map(k => `/p:${k}=${properties[k]}`);

	await io.writeToFile(join(temporaryDirectoryPath, "pruner.tmp.sln"), "");

	return [
		...propertyArguments,
		`/p:GenerateTargetFrameworkAttribute=False`,
		`/p:GenerateAssemblyInfo=False`,
		`--output`,
		`${temporaryDirectoryPath} `
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
		`trx; LogFileName =../ ${reportName} `,
		"--logger",
		"console;verbosity=detailed"
	];
}
