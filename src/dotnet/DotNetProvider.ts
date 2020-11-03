import { dirname, join } from "path";
import { readFile } from "fs/promises";
import {ChangedFiles, Provider} from "../providers";
import { parseStringPromise } from "xml2js";
import execa from "execa";
import { getPrunerPath, glob, normalizePathSeparators, writeToPrunerFile } from "../io";
import { ModuleModule, Root } from "./AltCoverTypes";
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
            const testsToRun = await this.getTestsToRun(previousState, changedFiles);
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
            .value();

        const trackedMethods = _.chain(modules)
            .flatMap(x => x.TrackedMethods)
            .flatMap(x => x.TrackedMethod)
            .map(x => x?.$)
            .filter(x => !!x)
            .value();

        const coverageData = _.chain(modules)
            .flatMap(x => x.Classes)
            .flatMap(x => x.Class)
            .flatMap(x => x.Methods)
            .flatMap(x => x.Method)
            .flatMap(x => x.SequencePoints)
            .flatMap(x => x.SequencePoint)
            .filter(x => !!x)
            .flatMap(x => ({
                trackedMethods: _.chain(x.TrackedMethodRefs || [])
                    .flatMap(m => m.TrackedMethodRef)
                    .map(m => m.$)
                    .map(m => trackedMethods.find(y => y?.uid === m?.uid))
                    .map(m => m.name)
                    .value(),
                filePath: normalizePathSeparators(files
                    .find(f => f.uid === x.$?.fileid)
                    ?.fullPath),
                lineNumbers: _.range(+x.$.sl, +x.$.el + 1)
            }))
            .groupBy(x => x.filePath)
            .filter(x => x[0].filePath.startsWith(projectRootDirectory))
            .map(x => ({
                tests: _.chain(x)
                    .flatMap(y => y.trackedMethods)
                    .uniq()
                    .value(),
                filePath: x[0].filePath.substring(projectRootDirectory.length + 1),
                lineNumbers: _.chain(x)
                    .flatMap(y => y.lineNumbers)
                    .uniq()
                    .value()
            }))
            .value();

        return coverageData;
    }

    private async getTestsToRun(previousState: State, changedFiles: ChangedFiles) {
        
    }
}

type State = Array<{
    tests: string[],
    filePath: string,
    lineNumbers: number[]
}>;