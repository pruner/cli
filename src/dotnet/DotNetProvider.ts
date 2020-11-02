import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import Provider from "../Provider";
import { glob } from "../utils";
import { parseStringPromise } from "xml2js";
import * as execa from "execa";

type State = Array<{
    CoverageSession: Array<{
        Modules: Array<{
            Module: Array<{
                Files: Array<{
                    $: {
                        uid: string,
                        fullPath: string
                    }
                }>,
                Classes: Array<{
                    Class: Array<{
                        Methods: Array<{
                            Method: Array<{
                                FileRef: Array<{
                                    $: {
                                        uid: string;
                                    }
                                }>,
                                SequencePoints: Array<{
                                    SequencePoint: Array<{
                                        $: {
                                            sl: string,
                                            el: string,
                                            fileid: string
                                        }
                                    }>
                                }>
                            }>
                        }>
                    }>
                }>,
                TrackedMethods: Array<{
                    TrackedMethod: Array<{
                        $: {
                            uid: string,
                            name: string
                        }
                    }>
                }>
            }>
        }>
    }>
}>

export default class DotNetProvider implements Provider<State> {
    constructor(
        private readonly workingDirectory: string,
        private readonly projectDirectoryGlob: string
    ) {}

    get name() {
        return "dotnet";
    }
    
    async run(previousState: State): Promise<execa.ExecaReturnValue<string>> {
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
                `/p:AltCoverCallContext="${callContextArgument}"`,
                "/p:AltCoverForce=true",
                "/p:AltCoverXmlReport=coverage.xml"
            ], 
            {
                cwd: this.workingDirectory
            });
        return result;
    }

    async gatherState() {
        const projectDirectoryPaths = await glob(
            this.workingDirectory,
            this.projectDirectoryGlob);

        const coverageFileBuffers = await Promise.all(projectDirectoryPaths
            .map(directoryPath => join(
                this.workingDirectory,
                directoryPath,
                "coverage.xml"))
            .map(filePath => readFile(filePath)));

        const state: State = await Promise.all(coverageFileBuffers
            .map(file => file.toString())
            .map(file => parseStringPromise(file, {
                async: true
            })));

        return state;
    }
}