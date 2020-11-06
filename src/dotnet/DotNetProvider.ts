import { join } from "path";
import fs from "fs";
import { Provider, Settings, SettingsQuestions, State, Test, Tests } from "../providers";
import { parseStringPromise } from "xml2js";
import execa from "execa";
import io from "../io";
import { Root } from "./altcover";
import { chain, range } from "lodash";
import git from "../git";
import { yellow, yellowBright } from "chalk";
import { getAltCoverArguments, getFilterArguments } from "./arguments";

export type DotNetSettings = Settings & {
    msTest: {
        categories: string[]
    }
};

const reportName = "coverage.xml.tmp.pruner";

export default class DotNetProvider implements Provider {
    constructor(private readonly settings: DotNetSettings) {
        console.debug("dotnet-init", settings);
    }

    public static get providerName() {
        return "dotnet";
    }

    public static getInitQuestions(): SettingsQuestions<DotNetSettings> {
        return {
            workingDirectory: {
                type: "text",
                message: "What relative directory would you like to run 'dotnet test' from?"
            },
            msTest: null,
            excludeFromWatch: null
        }
    }

    public getGlobPatterns() {
        return [
            "**/*.cs"
        ];
    }
    
    public async executeTestProcess(tests: Tests): Promise<execa.ExecaReturnValue<string>> {
        const args = [
            ...getFilterArguments(tests, this.settings),
            ...getAltCoverArguments(reportName)
        ];
        console.debug("execute-settings", this.settings);

        const result = await execa(
            "dotnet",
            [
                "test",
                ...args
            ], 
            {
                cwd: this.settings.workingDirectory,
                reject: false
            });
        if(typeof result.exitCode === "undefined")
            console.warn(yellow("It could look like you don't have the .NET Core SDK installed, required for the .NET provider."));

        return result;
    }

    public async gatherState(): Promise<State> {
        const projectRootDirectory = await git.getGitTopDirectory();

        const coverageFileContents = await io.globContents(
            `**/${reportName}`, {
                workingDirectory: this.settings.workingDirectory,
                deleteAfterRead: true
            });
        if(coverageFileContents.length === 0) {
            console.warn(yellow(`Could not find any coverage data from AltCover recursively within ${yellowBright(this.settings.workingDirectory)}. Make sure AltCover is installed in your test projects.`));
            return {
                coverage: [],
                files: [],
                tests: []
            };
        }

        const state: Root[] = await Promise.all(coverageFileContents
            .map(file => parseStringPromise(file, {
                async: true
            })));

        const modules = chain(state)
            .map(x => x.CoverageSession)
            .flatMap(x => x.Modules)
            .flatMap(x => x.Module)
            .filter(x => !!x)
            .value();

        const files = chain(modules)
            .flatMap(x => x.Files)
            .flatMap(x => x.File)
            .map(x => x?.$)
            .filter(x => !!x)
            .map(x => ({
                id: +x.uid,
                path: io.normalizePathSeparators(x.fullPath)
            }))
            .filter(x => x.path.startsWith(projectRootDirectory))
            .map(x => ({
                ...x,
                path: this.sanitizeStatePath(projectRootDirectory, x.path)
            }))
            .value();

        const tests = chain(modules)
            .flatMap(x => x.TrackedMethods)
            .flatMap(x => x.TrackedMethod)
            .map(x => x?.$)
            .filter(x => !!x)
            .map(x => ({
                name: this.sanitizeMethodName(x.name),
                id: +x.uid
            }))
            .value();

        const coverage = chain(modules)
            .flatMap(x => x.Classes)
            .flatMap(x => x.Class)
            .filter(x => !!x)
            .flatMap(x => x.Methods)
            .flatMap(x => x.Method)
            .filter(x => !!x)
            .flatMap(x => x.SequencePoints)
            .flatMap(x => x.SequencePoint)
            .filter(x => !!x)
            .flatMap(x => range(+x.$.sl, +x.$.el + 1)
                .map(l => ({
                    testIds: chain(x.TrackedMethodRefs || [])
                        .flatMap(m => m.TrackedMethodRef)
                        .map(m => m?.$)
                        .filter(m => !!m)
                        .map(m => +m.uid)
                        .value(),
                    fileId: +x?.$.fileid,
                    lineNumber: l
                })))
            .filter(x => !!x.fileId && x.testIds.length > 0)
            .value();

        console.debug("gather-state", "files", files);
        console.debug("gather-state", "coverage", coverage);

        const result = {
            tests: tests,
            files: files,
            coverage: coverage
        };
        return result;
    }

    private sanitizeStatePath(projectRootDirectory: string, path: string): string {
        path = path.substring(projectRootDirectory.length + 1);
        return path;
    }

    private sanitizeMethodName(name: string) {
        const typeSplit = name.split(' ');

        const namespaceAndName = typeSplit[1]
            .replace(/::/g, ".");
        
        return namespaceAndName.substr(0, namespaceAndName.indexOf('('));
    }
}
