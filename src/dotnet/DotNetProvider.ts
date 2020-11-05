import { join } from "path";
import { readFile } from "fs/promises";
import { Provider, Settings, SettingsQuestions, Test, Tests } from "../providers";
import { parseStringPromise } from "xml2js";
import execa from "execa";
import io from "../io";
import { Root } from "./altcover";
import { chain, range } from "lodash";
import git from "../git";

type DotNetSettings = Settings;

export default class DotNetProvider implements Provider {
    constructor(private readonly settings: DotNetSettings) {}

    public static get providerName() {
        return "dotnet";
    }

    public static getInitQuestions(): SettingsQuestions<DotNetSettings> {
        return {
            workingDirectory: {
                type: "text",
                message: "What working directory would you like to use?",
                hint: "The directory where you would normally run 'dotnet test' from."
            }
        }
    }

    public getGlobPatterns() {
        return [
            "**/*.cs"
        ];
    }
    
    public async executeTestProcess(tests: Tests): Promise<execa.ExecaReturnValue<string>> {
        const attributes = [
            "TestMethod",
            "Test",
            "Fact",
            "Theory"
        ];

        const callContextArgument = attributes
            .map(attribute => `[${attribute}]`)
            .join('|');

        const unknownFilter = this.getFilterArgument(tests.unaffected, {
            compare: "!=",
            join: "&"
        });

        const affectedFilter = this.getFilterArgument(tests.affected, {
            compare: "=",
            join: "|"
        });

        const filterArgument = [affectedFilter, unknownFilter]
            .filter(x => !!x)
            .map(x => `(${x})`)
            .join('|');

        const result = await execa(
            "dotnet",
            [
                "test",
                "--filter",
                filterArgument,
                "/p:AltCover=true",
                `/p:AltCoverCallContext=${callContextArgument}`,
                "/p:AltCoverForce=true",
                "/p:AltCoverXmlReport=coverage.xml.tmp.pruner"
            ], 
            {
                cwd: this.settings.workingDirectory,
                reject: false
            });
        return result;
    }

    private getFilterArgument(
        tests: Test[], 
        operandSettings: { join: string; compare: string; }) 
    {
        return tests
            .map(x => `FullyQualifiedName${operandSettings.compare}${x.name}`)
            .join(operandSettings.join);
    }

    public async gatherState() {
        const projectRootDirectory = await git.getGitTopDirectory();

        const coverageFileContents = await this.getFileContents("**/coverage.xml.tmp.pruner");

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
                path: x.path.substring(projectRootDirectory.length + 1)
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
            .flatMap(x => x.Methods)
            .flatMap(x => x.Method)
            .flatMap(x => x.SequencePoints)
            .flatMap(x => x.SequencePoint)
            .filter(x => !!x)
            .flatMap(x => range(+x.$.sl, +x.$.el + 1)
                .map(l => ({
                    testIds: chain(x.TrackedMethodRefs || [])
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

    private sanitizeMethodName(name: string) {
        const typeSplit = name.split(' ');

        const namespaceAndName = typeSplit[1]
            .replace(/::/g, ".");
        
        return namespaceAndName.substr(0, namespaceAndName.indexOf('('));
    }

    private async getFileContents(globPattern: string) {
        const filePaths = await io.glob(
            this.settings.workingDirectory,
            globPattern);
    
        const coverageFileBuffers = await Promise.all(filePaths
            .map(filePath => readFile(
                join(this.settings.workingDirectory, filePath))));
        return coverageFileBuffers
            .map(file => file.toString());
    }
}
