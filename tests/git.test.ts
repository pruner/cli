import { getCurrentDiffText } from "../src/git";

jest.setTimeout(1000 * 60 * 5);

describe("git", () => {
    test('getCurrentDiffText test', async () => {
        const diff = await getCurrentDiffText();
        expect(diff).not.toBeFalsy();
    });
});