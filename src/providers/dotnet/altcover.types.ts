export interface AltCoverRoot {
	CoverageSession: CoverageSession;
}

export interface CoverageSession {
	$: CoverageSessionClass;
	Summary: SummaryElement[];
	Modules: CoverageSessionModule[];
}

export interface CoverageSessionClass {
	"xmlns:xsd": string;
	"xmlns:xsi": string;
}

export interface CoverageSessionModule {
	Module: ModuleModule[];
}

export interface ModuleModule {
	$: Module;
	Summary: SummaryElement[];
	ModulePath: string[];
	ModuleTime: Date[];
	ModuleName: string[];
	Files: ModuleFile[];
	Classes: ModuleClass[];
	TrackedMethods: Array<PurpleTrackedMethod>;
}

export interface Module {
	hash: string;
}

export interface ModuleClass {
	Class: ClassClass[];
}

export interface ClassClass {
	Summary: SummaryElement[];
	FullName: string[];
	Methods: ClassMethod[];
}

export interface ClassMethod {
	Method: MethodMethod[];
}

export interface MethodMethod {
	$: Method;
	Summary: SummaryElement[];
	MetadataToken: string[];
	Name: string[];
	FileRef?: FileRefElement[];
	SequencePoints: Array<PurpleSequencePoint>;
	BranchPoints: Array<PurpleBranchPoint>;
	MethodPoint: MethodPointElement[];
}

export interface Method {
	visited: string;
	cyclomaticComplexity: string;
	nPathComplexity: string;
	sequenceCoverage: string;
	branchCoverage: string;
	isConstructor: string;
	isStatic: string;
	isGetter: string;
	isSetter: string;
	crapScore: string;
}

export interface PurpleBranchPoint {
	BranchPoint: FluffyBranchPoint[];
}

export interface FluffyBranchPoint {
	$: BranchPoint;
	Times: string[];
	TrackedMethodRefs: BranchPointTrackedMethodRef[];
}

export interface BranchPoint {
	vc: string;
	uspid: string;
	ordinal: string;
	offset: string;
	sl: string;
	path: string;
	offsetend: string;
	fileid: string;
}

export interface BranchPointTrackedMethodRef {
	TrackedMethodRef: TrackedMethodRefTrackedMethodRef[];
}

export interface TrackedMethodRefTrackedMethodRef {
	$: TrackedMethodRef;
}

export interface TrackedMethodRef {
	uid: string;
	vc: string;
}

export interface FileRefElement {
	$: FileRef;
}

export interface FileRef {
	uid: string;
}

export interface MethodPointElement {
	$: MethodPoint;
}

export interface MethodPoint {
	"xsi:type"?: XsiType;
	vc: string;
	uspid: string;
	ordinal: string;
	offset: string;
	sl?: string;
	sc?: string;
	el?: string;
	ec?: string;
	bec?: string;
	bev?: string;
	fileid?: string;
}

export enum XsiType {
	SequencePoint = "SequencePoint",
}

export interface PurpleSequencePoint {
	SequencePoint: FluffySequencePoint[];
}

export interface FluffySequencePoint {
	$: MethodPoint;
	Times?: string[];
	TrackedMethodRefs?: BranchPointTrackedMethodRef[];
}

export interface SummaryElement {
	$: Summary;
}

export interface Summary {
	numSequencePoints: string;
	visitedSequencePoints: string;
	numBranchPoints: string;
	visitedBranchPoints: string;
	sequenceCoverage: string;
	branchCoverage: string;
	maxCyclomaticComplexity: string;
	minCyclomaticComplexity: string;
	visitedClasses: string;
	numClasses: string;
	visitedMethods: string;
	numMethods: string;
	minCrapScore: string;
	maxCrapScore: string;
}

export interface ModuleFile {
	File: FileFile[];
}

export interface FileFile {
	$: File;
}

export interface File {
	uid: string;
	fullPath: string;
}

export interface PurpleTrackedMethod {
	TrackedMethod: FluffyTrackedMethod[];
}

export interface FluffyTrackedMethod {
	$: TrackedMethod;
}

export interface TrackedMethod {
	uid: string;
	token: string;
	name: string;
	strategy: Strategy;
}

export enum Strategy {
	TestMethod = "[TestMethod]",
}
