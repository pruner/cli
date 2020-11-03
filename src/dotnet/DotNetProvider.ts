import { join } from "path";
import { readFile } from "fs/promises";
import {ChangedFiles, Provider} from "../providers";
import { parseStringPromise } from "xml2js";
import execa from "execa";
import { glob, normalizePathSeparators } from "../io";
import { Root } from "./AltCoverTypes";
import _ from "lodash";
import { getGitTopDirectory } from "../git";

export default class DotNetProvider implements Provider<State> {
    constructor(
        private readonly workingDirectory: string,
        private readonly projectDirectoryGlob: string
    ) {}

    public get name() {
        return "dotnet";
    }
    
    public async run(previousState: State, changedFiles: ChangedFiles): Promise<execa.ExecaReturnValue<string>> {
        const testsToRun = await this.getTestsToRun(
            previousState, 
            changedFiles);

        const attributes = [
            "TestMethod",
            "Test",
            "Fact",
            "Theory"
        ];

        const callContextArgument = attributes
            .map(attribute => `[${attribute}]`)
            .join('|');

        const unknownFilter = this.getFilterArgument(testsToRun.unaffected, {
            compare: "!=",
            join: "&"
        });

        const affectedFilter = this.getFilterArgument(testsToRun.affected, {
            compare: "=",
            join: "|"
        });

        const filterArgument = [affectedFilter, unknownFilter]
            .filter(x => !!x)
            .map(x => `(${x})`)
            .join('|');
            
        console.log(filterArgument);
        
        const result = await execa(
            "dotnet",
            [
                "test",
                "--filter",
                filterArgument,
                "/p:AltCover=true",
                `/p:AltCoverCallContext=${callContextArgument}`,
                "/p:AltCoverForce=true",
                "/p:AltCoverXmlReport=coverage.xml"
            ], 
            {
                cwd: this.workingDirectory,
                reject: false
            });
        return result;
    }

    private getFilterArgument(tests: { name: string; id: number; }[], operandSettings: { join: string; compare: string; }) {
        return tests
            .map(x => `FullyQualifiedName${operandSettings.compare}${x.name}`)
            .join(operandSettings.join);
    }

    public async gatherState() {
        const projectRootDirectory = await getGitTopDirectory();

        const projectDirectoryPaths = await glob(
            this.workingDirectory,
            this.projectDirectoryGlob);

        const coverageFileBuffers = await Promise.all(projectDirectoryPaths
            .map(directoryPath => join(
                this.workingDirectory,
                directoryPath,
                "coverage.xml"))
            .map(filePath => readFile(filePath)));

        const state: Root[] = await Promise.all(coverageFileBuffers
            .map(file => file.toString())
            .map(file => parseStringPromise(file, {
                async: true
            })));

        const modules = _.chain(state)
            .map(x => x.CoverageSession)
            .flatMap(x => x.Modules)
            .flatMap(x => x.Module)
            .filter(x => !!x)
            .value();

        const files = _.chain(modules)
            .flatMap(x => x.Files)
            .flatMap(x => x.File)
            .map(x => x?.$)
            .filter(x => !!x)
            .map(x => ({
                id: +x.uid,
                path: normalizePathSeparators(x.fullPath)
            }))
            .filter(x => x.path.startsWith(projectRootDirectory))
            .map(x => ({
                ...x,
                path: x.path.substring(projectRootDirectory.length + 1)
            }))
            .value();

        const tests = _.chain(modules)
            .flatMap(x => x.TrackedMethods)
            .flatMap(x => x.TrackedMethod)
            .map(x => x?.$)
            .filter(x => !!x)
            .map(x => ({
                name: this.sanitizeMethodName(x.name),
                id: +x.uid
            }))
            .value();

        const coverage = _.chain(modules)
            .flatMap(x => x.Classes)
            .flatMap(x => x.Class)
            .flatMap(x => x.Methods)
            .flatMap(x => x.Method)
            .flatMap(x => x.SequencePoints)
            .flatMap(x => x.SequencePoint)
            .filter(x => !!x)
            .flatMap(x => _
                .range(+x.$.sl, +x.$.el + 1)
                .map(l => ({
                    testIds: _.chain(x.TrackedMethodRefs || [])
                        .flatMap(m => m.TrackedMethodRef)
                        .map(m => m.$)
                        .map(m => +m.uid)
                        .value(),
                    fileId: +x?.$.fileid,
                    lineNumber: l
                })))
            .filter(x => !!x.fileId && x.testIds.length > 0)
            .value();

        const result = {
            tests: tests,
            files: files,
            coverage: coverage
        };
        return result;
    }

    public async mergeState(previousState: State, newState: State): Promise<State> {
        return {
            tests: _.chain([previousState?.tests || [], newState.tests || []])
                .flatMap()
                .uniqBy(x => x.name)
                .value(),
            files: _.chain([previousState?.files || [], newState.files || []])
                .flatMap()
                .uniqBy(x => x.path)
                .value(),
            coverage: _.chain([previousState?.coverage || [], newState.coverage])
                .flatMap()
                .uniqBy(x => x.fileId + "-" + x.lineNumber)
                .value()
        };
    }

    private sanitizeMethodName(name: string) {
        const typeSplit = name.split(' ');

        const namespaceAndName = typeSplit[1]
            .replace(/::/g, ".");
        
        return namespaceAndName.substr(0, namespaceAndName.indexOf('('));
    }

    private async getTestsToRun(previousState: State, changedFiles: ChangedFiles) {
        if(!previousState) {
            return {
                affected: [],
                unaffected: []
            };
        }

        const affectedTests = changedFiles
            .flatMap(changedFile => {
                const file = previousState.files.find(x => x.path === changedFile.name);
                if(!file)
                    return [];

                const linesInFile = previousState.coverage.filter(x => x.fileId === file.id);
                const affectedLines = linesInFile.filter(x => changedFile.lineNumbers.indexOf(x.lineNumber) > -1);
                return _.flatMap(affectedLines, x => x.testIds);
            })
            .map(x => previousState.tests.find(y => y.id === x));
        
        const allKnownUnaffectedTests = previousState.tests.filter(x => !affectedTests.find(y => y.id === x.id));
        return {
            affected: affectedTests,
            unaffected: allKnownUnaffectedTests
        };
    }
}

type State = {
    tests: {
        name: string;
        id: number;
    }[];
    files: {
        id: number;
        path: string;
    }[];
    coverage: {
        testIds: number[];
        fileId: number;
        lineNumber: number;
    }[];
};