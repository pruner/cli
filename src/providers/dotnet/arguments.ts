import { StateTest, TestsByAffectedState } from "../providers";
import { DotNetSettings } from "./DotNetProvider";

export function getCallContextArgument() {
    const attributes = [
        "TestMethod",
        "Test",
        "Fact",
        "Theory"
    ];

    const callContextArgument = attributes
        .map(attribute => `[${attribute}]`)
        .join('|');
    return callContextArgument;
}

export function getAltCoverArguments(reportName: string) {
    const callContextArgument = getCallContextArgument();
    return [
        "/p:AltCover=true",
        `/p:AltCoverCallContext=${callContextArgument}`,
        "/p:AltCoverForce=true",
        `/p:AltCoverXmlReport=${reportName}`
    ];
}

export function getFilterArguments(tests: TestsByAffectedState, settings: DotNetSettings) {
    const unknownFilter = getTestFilterArgument(tests.unaffected, {
        compare: "!=",
        join: "&"
    });

    const affectedFilter = getTestFilterArgument(tests.affected, {
        compare: "=",
        join: "|"
    });

    const categoriesFilter = settings
        .msTest
        ?.categories
        .map(x => `TestCategory=${x}`);

    const filterArgument = combineFilterArguments(
        [
            combineFilterArguments(
                [
                    affectedFilter,
                    unknownFilter
                ], 
                '|'),
            combineFilterArguments(
                categoriesFilter, 
                '|')
        ], 
        '&');

    return ["--filter", filterArgument];
}

export function combineFilterArguments(orFilters: string[], join: string) {
    return orFilters
        ?.filter(x => !!x)
        .map(x => `(${x})`)
        .join(join);
}

export function getTestFilterArgument(
    tests: StateTest[], 
    operandSettings: { join: string; compare: string; }) 
{
    return tests
        .map(x => `FullyQualifiedName${operandSettings.compare}${x.name}`)
        .join(operandSettings.join);
}