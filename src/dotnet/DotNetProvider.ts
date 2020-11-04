import { join } from "path";
import { readFile } from "fs/promises";
import { Provider, SettingsQuestions, Tests } from "../providers";
import { parseStringPromise } from "xml2js";
import execa from "execa";
import { glob, normalizePathSeparators } from "../io";
import { Root } from "./altcover";
import _ from "lodash";
import { getGitTopDirectory } from "../git";

type Settings = {
    workingDirectory: string
}

export default class DotNetProvider implements Provider {
    constructor(private readonly settings: Settings) {}

    public static get providerName() {
        return "dotnet";
    }

    public static getInitQuestions(): SettingsQuestions<Settings> {
        return {
            workingDirectory: {
                type: "text",
                message: "What working directory would you like to use?",
                hint: "The directory where you would normally run 'dotnet test' from."
            }
        }
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
        console.log("filter", filterArgument);

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
        tests: { name: string; id: number; }[], 
        operandSettings: { join: string; compare: string; }) 
    {
        return tests
            .map(x => `FullyQualifiedName${operandSettings.compare}${x.name}`)
            .join(operandSettings.join);
    }

    public async gatherState() {
        const projectRootDirectory = await getGitTopDirectory();

        const coverageFileContents = await this.getFileContents("**/coverage.xml.tmp.pruner");

        const state: Root[] = await Promise.all(coverageFileContents
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

    private sanitizeMethodName(name: string) {
        const typeSplit = name.split(' ');

        const namespaceAndName = typeSplit[1]
            .replace(/::/g, ".");
        
        return namespaceAndName.substr(0, namespaceAndName.indexOf('('));
    }

    private async getFileContents(globPattern: string) {
        const filePaths = await glob(
            this.settings.workingDirectory,
            globPattern);
    
        const coverageFileBuffers = await Promise.all(filePaths
            .map(filePath => readFile(
                join(this.settings.workingDirectory, filePath))));
        return coverageFileBuffers
            .map(file => file.toString());
    }
}
