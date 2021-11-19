import { chain, flatMap, range } from "lodash";
import { TrxRoot } from "./trx.types";
import io from "../../io";
import git from "../../git";
import { StateFileCoverage, StateTest } from "../types";
import con from "../../console";
import { decode } from 'html-entities';

export async function parseTests(
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
				duration: parseDuration(x["@_duration"]) || null,
				id: previousDefinition.id,
				name: previousDefinition.name,
				failure: passed ? null : {
					stdout: stdout.length > 0 ? stdout : null,
					message: message || null,
					stackTrace: stackTrace.length > 0 ? stackTrace : null
				}
			});
		})
		.value();

	con.debug(() => ["test-results", testResults]);

	return tests;
}

function parseDuration(duration: string) {
	if (!duration)
		return null;

	let daySegments = duration.split('.', 2);
	if (daySegments[0].indexOf(':') > -1)
		daySegments = ['0', daySegments[0]];

	const days = daySegments[0] ?
		+daySegments[0] :
		0;

	const split = daySegments[1].split(':');
	const hours = +split[0];
	const minutes = +split[1];

	const secondSegments = split[2].split('.');
	const seconds = +secondSegments[0];
	const milliseconds = secondSegments[1] ?
		+secondSegments[1] :
		0;

	return milliseconds +
		(days * 24 * 60 * 60 * 1000) +
		(hours * 60 * 60 * 1000) +
		(minutes * 60 * 1000) +
		(seconds * 1000);
}

export function parseLineCoverage(modules: ModuleModule[]) {
	return chain(modules)
		.flatMap((x) => x?.Classes || [])
		.flatMap((x) => x?.Class || [])
		.filter((x) => !!x)
		.flatMap((x) => x?.Methods || [])
		.flatMap((x) => x?.Method || [])
		.filter((x) => !!x)
		.flatMap((x) => x?.SequencePoints || [])
		.flatMap((x) => x?.SequencePoint || [])
		.filter((x) => !!x)
		.flatMap((x) => range(+x["@_sl"], +x["@_el"] + 1).map((l) => ({
			testIds: chain(x.TrackedMethodRefs || [])
				.flatMap(m => m?.TrackedMethodRef || [])
				.filter((m) => !!m)
				.map((m) => m["@_uid"])
				.value(),
			fileId: x?.["@_fileid"],
			lineNumber: l,
		})))
		.filter((x) =>
			!!x.fileId &&
			x.testIds.length > 0)
		.value();
}

function sanitizeStatePath(projectRootDirectory: string, path: string): string {
	path = path.substring(projectRootDirectory.length + 1);
	return path;
}

function sanitizeMethodName(name: string) {
	const typeSplit = name.split(" ");

	const namespaceAndName = typeSplit[1].replace(/::/g, ".");

	return namespaceAndName.substr(0, namespaceAndName.indexOf("("));
}