// Generated by https://quicktype.io
//
// To change quicktype's target language, run command:
//
//   "Set quicktype target language"

export interface MochaPruner {
	"hello world": Hello;
	"hello darkness": Hello;
}

export interface Hello {
	"C:\\Users\\mathi\\source\\repos\\pruner\\cli\\tests\\mocha\\run\\temp\\src\\index.spec.ts": CUsersMathiSourceReposPrunerCLITestsMochaRunTempSrcIndexSpecTs;
	"C:\\Users\\mathi\\source\\repos\\pruner\\cli\\tests\\mocha\\run\\temp\\src\\index.ts": CUsersMathiSourceReposPrunerCLITestsMochaRunTempSrcIndexTs;
}

export interface CUsersMathiSourceReposPrunerCLITestsMochaRunTempSrcIndexSpecTs {
	path: string;
	statementMap: { [key: string]: StatementMap };
	fnMap: { [key: string]: FnMap };
	branchMap: BranchMapClass;
	s: { [key: string]: number };
	f: { [key: string]: number };
	b: BranchMapClass;
	inputSourceMap: InputSourceMap;
	_coverageSchema: string;
	hash: string;
}

export interface BranchMapClass {
}

export interface FnMap {
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

export interface CUsersMathiSourceReposPrunerCLITestsMochaRunTempSrcIndexTs {
	path: string;
	statementMap: { [key: string]: StatementMap };
	fnMap: CUsersMathiSourceReposPrunerCLITestsMochaRunTempSrcIndexTsFnMap;
	branchMap: BranchMap;
	s: { [key: string]: number };
	f: F;
	b: CUsersMathiSourceReposPrunerCLITestsMochaRunTempSrcIndexTsB;
	inputSourceMap: InputSourceMap;
	_coverageSchema: string;
	hash: string;
}

export interface CUsersMathiSourceReposPrunerCLITestsMochaRunTempSrcIndexTsB {
	"0": number[];
}

export interface BranchMap {
	"0": The0;
}

export interface The0 {
	loc: StatementMap;
	type: string;
	locations: StatementMap[];
	line: number;
}

export interface F {
	"0": number;
}

export interface CUsersMathiSourceReposPrunerCLITestsMochaRunTempSrcIndexTsFnMap {
	"0": FnMap;
}
