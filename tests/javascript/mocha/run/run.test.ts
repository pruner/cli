jest.setTimeout(1000 * 60 * 5);

import { prepareRunTest } from '../../../helpers/run';

const context = prepareRunTest("mocha", "javascript/mocha");

test('run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(2);

	const coverage = await context.getCoveredLineNumbersForFile("src/index.ts");
	expect(coverage).toEqual([
		context.passedLineRange(2, 9),
		context.passedLineRange(3, 19),
		context.passedLineRange(21)
	]);
});

test('run - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(2);

	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(0);

	const coverage = await context.getCoveredLineNumbersForFile("src/index.ts");
	expect(coverage).toEqual([
		context.passedLineRange(3, 19),
		context.passedLineRange(21)
	]);
});

test('run - change condition - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(2);

	await context.overwriteCode("src/index.condition-change.ts");
	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(2);

	const coverage = await context.getCoveredLineNumbersForFile("src/index.ts");
	expect(coverage).toEqual([
		...context.failedLineRange(10, 11),
		...context.failedLineRange(22, 31),
		...context.failedLineRange(33)
	]);
});