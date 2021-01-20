import { chain, first, flatMap, range } from "lodash";
import { AltCoverRoot, ModuleModule } from "./altcover.types";
import { TrxRoot } from "./trx.types";
import io from "../../io";
import git from "../../git";
import { StateFileCoverage, StateTest } from "../types";
import con from "../../console";

export function parseModules(altCoverXmlAsJson: AltCoverRoot[]) {
	return chain(altCoverXmlAsJson)
		.flatMap((x) => x?.CoverageSession || [])
		.flatMap((x) => x?.Modules || [])
		.flatMap((x) => x?.Module || [])
		.filter((x) => !!x)
		.value();
}

function parseFiles(modules: ModuleModule[], projectRootDirectory: string) {
	return chain(modules)
		.flatMap((x) => x?.Files || [])
		.flatMap((x) => x?.File || [])
		.filter((x) => !!x)
		.map((x) => ({
			id: x["@_uid"],
			path: io.normalizePathSeparators(x["@_fullPath"]),
		}))
		.filter((x) => x.path.startsWith(projectRootDirectory))
		.map((x) => ({
			...x,
			path: sanitizeStatePath(projectRootDirectory, x.path),
		}))
		.value();
}

export async function parseTests(
	altCoverModules: ModuleModule[],
	trxSummary: TrxRoot[]
): Promise<StateTest[]> {
	const projectRootDirectory = await git.getGitTopDirectory();

	const files = parseFiles(altCoverModules, projectRootDirectory);
	const coverage = parseLineCoverage(altCoverModules);

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
				.map(t => t?.StdOut)
				?.split('\n')
				.filter(t => !!t)
				.map(t => t.trim())
				.value() || [];

			const errorInformation = first(outputs)?.ErrorInfo;
			const stackTrace = errorInformation?.StackTrace
				?.split('\n')
				.filter(t => !!t)
				.map(t => t.trim()) || [];

			const message = errorInformation?.Message?.trim();

			const previousDefinition = testDefinitions.find(t => t.id === x["@_testId"]);
			return ({
				duration: parseDuration() || null,
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

	const tests = chain(altCoverModules)
		.flatMap(x => x?.TrackedMethods || [])
		.flatMap(x => x?.TrackedMethod || [])
		.filter(x => !!x)
		.map(x => {
			const testResult = testResults.find(t => t.name === sanitizeMethodName(x["@_name"]));
			return <StateTest>{
				duration: testResult?.duration || null,
				failure: testResult?.failure || null,
				name: sanitizeMethodName(x["@_name"]),
				fileCoverage: chain(coverage)
					.filter(f => f.testIds.indexOf(x["@_uid"]) > -1)
					.groupBy(f => f.fileId)
					.map(g => <StateFileCoverage>({
						path: files.find(f => f.id === g[0].fileId).path,
						lineCoverage: g.map(l => l.lineNumber)
					}))
					.value()
			};
		})
		.value();
	return tests;
}

function parseDuration() {
	return -1;
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