import { pruner } from "../../../exports";

const BaseReporter = require('mocha/lib/reporters/base');
const Runner = require('mocha/lib/runner');

const constants = Runner.constants;

module.exports = exports = class MochaReporter extends BaseReporter {
	constructor(runner, options) {
		super(runner, options);

		const coverageKey = "__coverage__";
		const coveragePerTest = {};

		const resetCoverage = function () {
			if (typeof (global[coverageKey]) === "undefined" || !global[coverageKey])
				return;

			for (let key in global[coverageKey]) {
				const coverage = global[coverageKey][key];
				for (let i in coverage.b)
					coverage.b[i] = [0, 0];

				for (let i in coverage.f)
					coverage.f[i] = 0;

				for (let i in coverage.s)
					coverage.s[i] = 0;
			}
		}

		runner.on(constants.EVENT_TEST_BEGIN, function () {
			resetCoverage();
		});

		runner.on(constants.EVENT_TEST_END, function (test) {
			coveragePerTest[test.title] = JSON.parse(JSON.stringify(global[coverageKey]));
		});

		runner.on(constants.EVENT_RUN_END, async function () {
			await pruner.writeToTempFile("mocha.json", JSON.stringify(coveragePerTest));
		});
	}
}