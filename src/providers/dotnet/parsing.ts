import { chain, flatMap, range } from "lodash";
import { TrxRoot } from "./trx.types";
import io from "../../io";
import git from "../../git";
import { StateFileCoverage, StateTest } from "../types";
import con from "../../console";
import { decode } from 'html-entities';

export async function parseTrxSummary(
	trxSummary: TrxRoot[]
): Promise<StateTest[]> {
	const testRuns = chain(trxSummary)
		.flatMap(x => x.TestRun)
		.value();
	const testDefinitions = chain(testRuns)
		.flatMap(x => x.TestDefinitions || [])
		.flatMap(x => x?.UnitTest || [])
		.filter(x => !!x)
		.flatMap(x => flatMap(x.TestMethod, t => ({
			id: x["@_id"],
			name: `${t["@_className"]}.${t["@_name"]}`
		})))
		.value();
	const testResults = chain(testRuns)
		.flatMap(x => x.Results || [])
		.flatMap(x => x?.UnitTestResult || [])
		.filter(x => !!x)
		.map(x => {
			const passed = x["@_outcome"] === "Passed";
			const outputs = x?.Output || [];

			const stdout = chain(outputs)
				.flatMap(t => t?.StdOut || "")
				.first()
				?.split('\n')
				.filter(t => !!t)
				.map(t => decode(t).trim())
				.filter(t => !!t)
				.value() || [];

			const errorInformation = chain(outputs)
				.flatMap(t => t?.ErrorInfo || [])
				.first()
				.value();
			const stackTrace = errorInformation?.StackTrace
				?.split('\n')
				.filter(t => !!t)
				.map(t => decode(t).trim()) || [];

			const message = decode(errorInformation?.Message || "").trim();

			const previousDefinition = testDefinitions.find(t => t.id === x["@_testId"]);
			return ({
				duration: parseDuration(x["@_duration"]),
				id: previousDefinition.id,
				name: previousDefinition.name,
				fileCoverage: [],
				failure: passed ? null : {
					stdout: stdout.length > 0 ? stdout : null,
					message: message || null,
					stackTrace: stackTrace.length > 0 ? stackTrace : null
				}
			});
		})
		.value();

	con.debug(() => ["test-results", testResults]);

	return testResults;
}

function parseDuration(duration: string | number | null | undefined) {
	if (duration === "0")
		return 0;

	if (typeof duration === "number")
		return duration;

	if (!duration)
		return null;

	const split = duration.split(':');
	const hours = +split[0];
	const minutes = +split[1];

	const seconds = +split[2];

	return (hours * 60 * 60 * 1000) +
		(minutes * 60 * 1000) +
		(seconds * 1000);
}