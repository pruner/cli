import { join } from "path";
import { readFile } from "fs/promises";
import {ChangedFiles, Provider} from "../providers";
import { parseStringPromise } from "xml2js";
import execa from "execa";
import { glob, writeToPrunerFile } from "../io";
import { ModuleModule, Root } from "./AltCoverTypes";
import _ from "lodash";

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
            .value();

        const files = _.chain(modules)
            .flatMap(x => x.Files)
            .flatMap(x => x.File)
            .map(x => x?.$)
            .value();

        const trackedMethods = _.chain(modules)
            .flatMap(x => x.TrackedMethods)
            .flatMap(x => x.TrackedMethod)
            .map(x => x?.$)
            .value();

        const coverageData = _.chain(modules)
            .flatMap(x => x.Classes)
            .flatMap(x => x.Class)
            .flatMap(x => x.Methods)
            .flatMap(x => x.Method)
            .flatMap(x => x.SequencePoints)
            .flatMap(x => x.SequencePoint)
            .flatMap(x => ({
                trackedMethods: _.chain(x?.TrackedMethodRefs || [])
                    .flatMap(m => m.TrackedMethodRef)
                    .map(m => m.$)
                    .map(m => trackedMethods.find(y => y?.uid === m?.uid))
                    .map(m => m.name)
                    .value(),
                filePath: files
                    .find(f => f.uid === x?.$?.fileid)
                    ?.fullPath,
                lineNumbers: new Array((+x?.$?.el || 0) - (+x?.$?.sl || 0))
                    .map((_, i) => +x.$.sl + i)
            }))
            .value();

        return coverageData;
    }

    private async getTestsToRun(previousState: State, changedFiles: ChangedFiles) {
        await writeToPrunerFile("changed", JSON.stringify(changedFiles, null, ' '));
    }
}

type State = Array<{
    trackedMethods: string[],
    filePath: string,
    lineNumbers: number[]
}>;