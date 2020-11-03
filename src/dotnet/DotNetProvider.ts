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
        if(previousState) {
            await this.getTestsToRun(previousState, changedFiles);
        }

        const attributes = [
            "TestMethod",
            "Test",
            "Fact",
            "Theory"
        ];

        const callContextArgument = attributes
            .map(attribute => `[${attribute}]`)
            .join('|');
            
        const result = await execa(
            "dotnet",
            [
                "test",
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
            .value();

        const trackedMethods = _.chain(modules)
            .flatMap(x => x.TrackedMethods)
            .flatMap(x => x.TrackedMethod)
            .map(x => x?.$)
            .filter(x => !!x)
            .map(x => ({
                name: x.name,
                id: +x.uid
            }))
            .value();

        const coverageData = _.chain(modules)
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
                        .map(m => trackedMethods.find(y => y?.id === +m.uid))
                        .map(m => m.id)
                        .value(),
                    fileId: files
                        .find(f => 
                            f.id === +x.$?.fileid &&
                            f.path.startsWith(projectRootDirectory))
                        ?.id,
                    lineNumber: l
                })))
            .filter(x => !!x.fileId && x.testIds.length > 0)
            .value();

        const result = {
            tests: trackedMethods,
            files: files,
            coverage: coverageData
        };
        return result;
    }

    private async getTestsToRun(previousState: State, changedFiles: ChangedFiles) {
        for(let file of previousState.files) {
            
        }
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