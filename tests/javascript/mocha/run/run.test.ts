jest.setTimeout(1000 * 60 * 5);

import { prepareRunTest } from '../../../helpers/run';

const context = prepareRunTest("mocha", "javascript/mocha");

test('mocha: run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(2);

	const coverage = await context.getCoveredLineNumbersForFile("src/index.ts");
	expect(coverage).toEqual([
		...context.passedLineRange(2),
		...context.passedLineRange(4, 12),
		...context.passedLineRange(14, 21)
	]);
});

test('mocha: run - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(2);

	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(0);

	const coverage = await context.getCoveredLineNumbersForFile("src/index.ts");
	expect(coverage).toEqual([
		...context.passedLineRange(2),
		...context.passedLineRange(4, 12),
		...context.passedLineRange(14, 21)
	]);
});

test('mocha: run - change condition - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(2);

	await context.overwriteCode("src/index.condition-change.ts");
	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(2);

	const coverage = await context.getCoveredLineNumbersForFile("src/index.ts");
	expect(coverage).toEqual([
		...context.failedLineRange(2),
		...context.failedLineRange(4, 12),
		...context.failedLineRange(14, 21)
	]);
});

test('mocha: run - make change in first if-branch - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(2);

	await context.overwriteCode("src/index.first-branch-change.ts");
	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(1);

	const coverage = await context.getCoveredLineNumbersForFile("src/index.ts");
	expect(coverage).toEqual([
		...context.passedLineRange(2),
		...context.passedLineRange(4, 12),
		...context.passedLineRange(14, 21)
	]);
});