import DotNetCommand from "../../src/dotnet/DotNetCommand";
import {join} from 'path';

jest.setTimeout(1000 * 60 * 5);

describe("DotNetCommand", () => {
    test('highway test', async () => {
        await DotNetCommand.handler({
            "working-directory": join(
                __dirname,
                "sample"),
            "project-directory-glob": "**/*.Tests",
            $0: null,
            _: null
        });
    });
});