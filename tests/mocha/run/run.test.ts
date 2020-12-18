jest.setTimeout(1000 * 60 * 5);

import { prepareRunTest } from '../../helpers/run';

const context = prepareRunTest("mocha");

test('run - check test count', async () => {
	const testRun1 = await context.runHandler();
	expect(testRun1.length).toBe(2);
});