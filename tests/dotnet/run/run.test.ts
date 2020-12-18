jest.setTimeout(1000 * 60 * 5);

import execa from 'execa';
import _ from 'lodash';

import { prepareRunTest } from '../../helpers/run';

const context = prepareRunTest(
	"dotnet",
	async (sampleOriginDirectoryPath: string) => {
		await execa("dotnet", ["clean"], {
			cwd: sampleOriginDirectoryPath
		});
	});

test('run - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(12);

	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(0);

	const coverage = await context.getCoveredLineNumbersForFile("Sample/SomeClass.cs");
	expect(coverage).toEqual([
		...context.passedLineRange(10, 20),
		...context.passedLineRange(22, 31),
		...context.passedLineRange(33)
	]);
});

test('run - change condition - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(12);

	await context.overwriteCode("Sample/SomeClass.condition-change.cs");
	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(12);

	const coverage = await context.getCoveredLineNumbersForFile("Sample/SomeClass.cs");
	expect(coverage).toEqual([
		...context.failedLineRange(10, 11),
		...context.failedLineRange(22, 31),
		...context.failedLineRange(33)
	]);
});

test('run - check coverage', async () => {
	const testRun = await context.runHandler();
	expect(testRun.length).toBe(12);

	const coverage = await context.getCoveredLineNumbersForFile("Sample/SomeClass.cs");
	expect(coverage).toEqual([
		...context.passedLineRange(10, 20),
		...context.passedLineRange(22, 31),
		...context.passedLineRange(33)
	]);
});

test('run - change condition - run - revert condition - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(12);

	await context.overwriteCode("Sample/SomeClass.condition-change.cs");
	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(12);

	await context.revertCode("Sample/SomeClass.cs");
	const testRun3 = await context.runHandler();
	expect(testRun3.length).toBe(12);

	const coverage = await context.getCoveredLineNumbersForFile("Sample/SomeClass.cs");
	expect(coverage).toEqual([
		...context.passedLineRange(10, 20),
		...context.passedLineRange(22, 31),
		...context.passedLineRange(33)
	]);
});

test('run - comment out test - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(12);

	await context.overwriteCode("Sample.Tests/SampleDarknessTests.commented.cs");
	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(0);

	const coverageForTest = await context.getCoveredLineNumbersForFile("Sample.Tests/SampleDarknessTests.cs");
	expect(coverageForTest).toEqual([]);

	const coverageForClass = await context.getCoveredLineNumbersForFile("Sample/SomeClass.cs");
	expect(coverageForClass).toEqual([
		...context.passedLineRange(10, 20),
		...context.passedLineRange(33)
	]);
});

test('run - make darkness tests fail - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(12);

	await context.overwriteCode("Sample/SomeClass.darkness-test-fail.cs");
	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(6);

	const coverage = await context.getCoveredLineNumbersForFile("Sample/SomeClass.cs");
	expect(coverage).toEqual([
		...context.failedLineRange(10, 11),
		...context.passedLineRange(12, 20),
		...context.failedLineRange(22, 31),
		...context.failedLineRange(33)
	]);
});

test('run - make change in first if-branch - run - check coverage', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(12);

	await context.overwriteCode("Sample/SomeClass.first-branch-change.cs");
	const testRun2 = await context.runHandler();
	expect(testRun2.length).toBe(6);

	const coverage = await context.getCoveredLineNumbersForFile("Sample/SomeClass.cs");
	expect(coverage).toEqual([
		...context.passedLineRange(10, 20),
		...context.passedLineRange(22, 31),
		...context.passedLineRange(33)
	]);
});