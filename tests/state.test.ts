import { mergeStates } from "../src/commands/run/state";
import { ProviderState, StateTest } from "../src/providers/types";

test("state: merge two providers with same test ids, but different file paths", async () => {
	const oldObject: ProviderState = {
		tests: [
			{
				name: "x1",
				fileCoverage: [
					{
						path: "path2.cs",
						lineCoverage: [1]
					}
				]
			} as StateTest
		]
	};

	const newObject: ProviderState = {
		tests: [
			{
				name: "x1",
				fileCoverage: [
					{
						path: "path1.cs",
						lineCoverage: [2]
					}
				]
			} as StateTest
		]
	};

	const merged = await mergeStates(
		[],
		oldObject,
		newObject);

	expect(merged).toStrictEqual({
		tests: [
			{
				failure: null,
				duration: null,
				name: "x1",
				fileCoverage: [
					{
						path: "path1.cs",
						lineCoverage: [2]
					},
					{
						path: "path2.cs",
						lineCoverage: [1]
					}
				]
			} as StateTest
		]
	});
});