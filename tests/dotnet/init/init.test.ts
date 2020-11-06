jest.setTimeout(1000 * 60 * 5);

import { join } from 'path';
import { handler } from '../../../src/commands/InitCommand';
import _ from 'lodash';
import { Settings } from '../../../src/providers';
import { DotNetSettings } from '../../../src/dotnet/DotNetProvider';

import rimraf from 'rimraf';
import { copy } from 'fs-extra';

import io from '../../../src/io';
import con from '../../../src/console';
import git from '../../../src/git';

con.ask = async () => ({});
git.getGitTopDirectory = async () => "tests/dotnet/init/temp";
io.getPrunerPath = async () => "tests/dotnet/init/temp/.pruner";

describe("init", () => {
    const currentDirectory = join("tests", "dotnet", "init");

    const cleanup = async () => {
        rimraf.sync(join(currentDirectory, "temp"));
    }

    const runHandler = async () => {
        return await handler({
            provider: "dotnet",
            verbosity: "verbose"
        });
    }

    beforeEach(async () => {
        await cleanup();

        const temporaryFolderPath = join(__dirname, "temp");
        await copy(
            join(__dirname, "..", "sample"),
            temporaryFolderPath);
    });

    test('init -> check for settings', async () => {
        await runHandler();
        
        const settings = JSON.parse(await io.readFromPrunerFile("settings.json")) as Settings;
        expect(settings).not.toBeNull();

        const dotNetSettings = settings["dotnet"] as DotNetSettings[];
        expect(dotNetSettings).not.toBeNull();
        expect(dotNetSettings).toHaveLength(1);

        const dotNetSetting = dotNetSettings[0];
        expect(dotNetSetting).not.toBeNull();
    });
});