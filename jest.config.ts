/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

export default {
	bail: 1,
	maxConcurrency: 1,
	testEnvironment: 'node',
	coverageProvider: "babel",
	testPathIgnorePatterns: [
		"\\\\node_modules\\\\",
		"\\\\dist\\\\"
	],
	verbose: false,
	silent: false
};
