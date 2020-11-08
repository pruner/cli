export interface TrxRoot {
	TestRun: TestRun;
}

export interface TestRun {
	$: TestRunClass;
	Times: TimeElement[];
	TestSettings: TestSetting[];
	Results: Result[];
	TestDefinitions: TestDefinition[];
	TestEntries: TestRunTestEntry[];
	TestLists: TestRunTestList[];
	ResultSummary: ResultSummaryElement[];
}

export interface TestRunClass {
	id: string;
	name: string;
	runUser: string;
	xmlns: string;
}

export interface ResultSummaryElement {
	$: ResultSummary;
	Counters: CounterElement[];
}

export interface ResultSummary {
	outcome: string;
}

export interface CounterElement {
	$: Counter;
}

export interface Counter {
	total: string;
	executed: string;
	passed: string;
	failed: string;
	error: string;
	timeout: string;
	aborted: string;
	inconclusive: string;
	passedButRunAborted: string;
	notRunnable: string;
	notExecuted: string;
	disconnected: string;
	warning: string;
	completed: string;
	inProgress: string;
	pending: string;
}

export interface Result {
	UnitTestResult: UnitTestResultElement[];
}

export interface UnitTestResultElement {
	$: UnitTestResult;
	Output: Output[];
}

export interface UnitTestResult {
	executionId: string;
	testId: string;
	testName: string;
	computerName: ComputerName;
	duration: string;
	startTime: Date;
	endTime: Date;
	testType: string;
	outcome: Outcome;
	testListId: string;
	relativeResultsDirectory: string;
}

export enum ComputerName {
	Surfacestudio = "SURFACESTUDIO",
}

export enum Outcome {
	Passed = "Passed",
}

export interface Output {
	StdOut: string[];
}

export interface TestDefinition {
	UnitTest: UnitTestElement[];
}

export interface UnitTestElement {
	$: UnitTest;
	Execution: ExecutionElement[];
	TestMethod: TestMethodElement[];
}

export interface UnitTest {
	name: string;
	storage: string;
	id: string;
}

export interface ExecutionElement {
	$: Execution;
}

export interface Execution {
	id: string;
}

export interface TestMethodElement {
	$: TestMethod;
}

export interface TestMethod {
	codeBase: string;
	adapterTypeName: AdapterTypeName;
	className: ClassName;
	name: string;
}

export enum AdapterTypeName {
	ExecutorMstestadapterV2 = "executor://mstestadapter/v2",
}

export enum ClassName {
	SampleTestsDarknessSampleDarknessTests = "Sample.Tests.Darkness.SampleDarknessTests",
	SampleTestsWorldSampleWorldTests = "Sample.Tests.World.SampleWorldTests",
}

export interface TestRunTestEntry {
	TestEntry: TestEntryTestEntry[];
}

export interface TestEntryTestEntry {
	$: TestEntry;
}

export interface TestEntry {
	testId: string;
	executionId: string;
	testListId: string;
}

export interface TestRunTestList {
	TestList: TestListTestList[];
}

export interface TestListTestList {
	$: TestList;
}

export interface TestList {
	name: string;
	id: string;
}

export interface TestSetting {
	$: TestList;
	Deployment: DeploymentElement[];
}

export interface DeploymentElement {
	$: Deployment;
}

export interface Deployment {
	runDeploymentRoot: string;
}

export interface TimeElement {
	$: Time;
}

export interface Time {
	creation: Date;
	queuing: Date;
	start: Date;
	finish: Date;
}
