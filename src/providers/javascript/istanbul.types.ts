export interface IstanbulCoverageRoot {
	[testName: string]: TestCoverage;
}

export interface TestCoverage {
	[fileName: string]: FileCoverage;
}

export interface StatementCoverage {
	[id: string]: number;
}

export interface StatementMaps {
	[key: string]: StatementMap;
}

export interface FileCoverage {
	path: string;
	statementMap: StatementMaps;
	fnMap: FunctionMaps;
	branchMap: BranchMaps;
	s: StatementCoverage;
	f: FunctionCoverage;
	b: BranchCoverage;
	inputSourceMap: InputSourceMap;
	hash: string;
}

export interface BranchMapClass {
}

export interface FunctionMap {
	name: string;
	decl: StatementMap;
	loc: StatementMap;
	line: number;
}

export interface StatementMap {
	start: End;
	end: End;
}

export interface End {
	line: number;
	column: number;
}

export interface InputSourceMap {
	version: number;
	file: string;
	sources: string[];
	names: any[];
	mappings: string;
	sourcesContent: string[];
}

export interface BranchCoverage {
	[id: string]: number[];
}

export interface BranchMaps {
	[id: string]: {
		loc: StatementMap;
		type: string;
		locations: StatementMap[];
		line: number;
	};
}
export interface FunctionCoverage {
	[id: string]: number;
}

export interface FunctionMaps {
	[id: string]: FunctionMap;
}
