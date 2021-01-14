import { chain, first, range } from "lodash";
import { AltCoverRoot, ModuleModule } from "./altcover.types";
import { TrxRoot } from "./trx.types";
import io from "../../io";
import { StateFile, StateLineCoverage, StateTest } from "../types";
import con from "../../console";

export function parseModules(altCoverXmlAsJson: AltCoverRoot[]) {
	return chain(altCoverXmlAsJson)
		.map((x) => x.CoverageSession)
		.flatMap((x) => x.Modules)
		.flatMap((x) => x.Module)
		.filter((x) => !!x)
		.value();
}

export function parseFiles(modules: ModuleModule[], projectRootDirectory: string): StateFile[] {
	return chain(modules)
		.flatMap((x) => x.Files)
		.flatMap((x) => x.File)
		.map((x) => x?.$)
		.filter((x) => !!x)
		.map((x) => ({
			id: +x.uid,
			path: io.normalizePathSeparators(x.fullPath),
		}))
		.filter((x) => x.path.startsWith(projectRootDirectory))
		.map((x) => <StateFile>({
			...x,
			id: `f${x.id}`,
			path: sanitizeStatePath(projectRootDirectory, x.path),
		}))
		.value();
}

export function parseTests(
	altCoverModules: ModuleModule[],
	trxSummary: TrxRoot[]
): StateTest[] {
	const testRuns = trxSummary.map(x => x.TestRun);
	const testDefinitions = chain(testRuns)
		.flatMap(x => x.TestDefinitions)
		.flatMap(x => x?.UnitTest)
		.filter(x => !!x)
		.flatMap(x => x
			.TestMethod
			.map(t => ({
				id: x.$.id,
				name: `${t.$.className}.${t.$.name}`
			})))
		.value();
	const testResults = chain(testRuns)
		.flatMap(x => x.Results)
		.flatMap(x => x?.UnitTestResult)
		.filter(x => !!x)
		.map(x => {
			const passed = x.$.outcome === "Passed";
			const outputs = x?.Output || [];

			const stdout = chain(outputs)
				.flatMap(t => t?.StdOut || [])
				.first()
				.split('\n')
				.filter(t => !!t)
				.map(t => t.trim())
				.value();

			const errorInformation = chain(outputs)
				.flatMap(t => t?.ErrorInfo || [])
				.first()
				.value();

			const stackTrace = chain(errorInformation?.StackTrace || [])
				.first()
				.split('\n')
				.filter(t => !!t)
				.map(t => t.trim())
				.value();

			const message = first(errorInformation?.Message || [])?.trim();

			const previousDefinition = testDefinitions.find(t => t.id === x.$.testId);
			return ({
				duration: parseDuration() || null,
				...previousDefinition,
				failure: passed ? null : {
					stdout: stdout.length > 0 ? stdout : null,
					message: message || null,
					stackTrace: stackTrace.length > 0 ? stackTrace : null
				}
			});
		})
		.value();

	con.debug(() => ["test-results", testResults]);

	return chain(altCoverModules)
		.flatMap(x => x.TrackedMethods)
		.flatMap(x => x.TrackedMethod)
		.map(x => x?.$)
		.filter(x => !!x)
		.uniqBy(x => x.name)
		.map(x => {
			const previousResult = testResults.find(t => t.name === sanitizeMethodName(x.name));
			return <StateTest>{
				failure: null,
				errorMessage: void 0,
				stdout: void 0,
				...previousResult,
				name: sanitizeMethodName(x.name),
				id: `t${+x.uid}`
			};
		})
		.value();
}

function parseDuration() {
	return -1;
}

export function parseLineCoverage(modules: ModuleModule[]): StateLineCoverage[] {
	return chain(modules)
		.flatMap((x) => x.Classes)
		.flatMap((x) => x.Class)
		.filter((x) => !!x)
		.flatMap((x) => x.Methods)
		.flatMap((x) => x.Method)
		.filter((x) => !!x)
		.flatMap((x) => x.SequencePoints)
		.flatMap((x) => x.SequencePoint)
		.filter((x) => !!x)
		.flatMap((x) => range(+x.$.sl, +x.$.el + 1).map((l) => <StateLineCoverage>({
			testIds: chain(x.TrackedMethodRefs || [])
				.flatMap((m) => m.TrackedMethodRef)
				.map((m) => m?.$)
				.filter((m) => !!m)
				.map((m) => `t${+m.uid}`)
				.value(),
			fileId: `f${+x?.$.fileid}`,
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