import { StateTest, TestsByAffectedState } from "../types";
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
		`/p:AltCoverCallContext=${callContextArgument}`,
		"/p:AltCoverForce=true",
		`/p:AltCoverXmlReport=${reportName}`
	];
}

export function getRunSettingArguments(runSettingFilePath: string) {
	return [
		"--settings",
		runSettingFilePath
	];
}

export function getLoggerArguments(reportName: string) {
	return [
		"--logger",
		`trx;LogFileName=../${reportName}`
	];
}