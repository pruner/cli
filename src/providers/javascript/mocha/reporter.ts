import { AssertionError } from "assert";
import { pruner } from "../../../exports";
import { IstanbulCoverageRoot } from "../istanbul.types";

const libCoverage = require('istanbul-lib-coverage');
const libSourceMaps = require('istanbul-lib-source-maps');
const BaseReporter = require('mocha/lib/reporters/base');
const Runner = require('mocha/lib/runner');

const constants = Runner.constants;

type Test = {
	type: 'test',
	title: string,
	parent: Suite,
	timedOut: boolean,
	file: string,
	state: 'failed' | 'passed',
	err: AssertionError,
	duration: number,
	speed?: 'fast'
}

type Suite = {
	title: string,
	tests: Test[],
	root: boolean
}

export type MochaCoverageContext = {
	coverage: IstanbulCoverageRoot,
	state: Test["state"],
	error: AssertionError,
	duration: number,
	name: string
}

module.exports = exports = class MochaReporter extends BaseReporter {
	constructor(runner, options) {
		super(runner, options);

		const coverageKey = "__coverage__";
		const coverageResults = new Array<MochaCoverageContext>();

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

		runner.on(constants.EVENT_TEST_END, async function (test: Test) {
			const coverageData = global[coverageKey];
			const coverageMap = libCoverage.createCoverageMap(coverageData);
			const mapStore = libSourceMaps.createSourceMapStore({});

			const transformed = await mapStore.transformCoverage(coverageMap);
			coverageResults.push({
				coverage: libCoverage.createCoverageMap(transformed),
				state: test.state,
				duration: test.duration,
				error: test.err,
				name: test.title
			});
		});

		runner.on(constants.EVENT_RUN_END, async function () {
			await pruner.writeToTempFile("mocha.json", JSON.stringify(coverageResults, null, "\t"));
		});
	}
}