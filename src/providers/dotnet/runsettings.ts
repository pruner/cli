import pruner from '../../pruner';
import { DotNetSettings } from './DotNetProvider';

import xmlescape from 'xml-escape';

export async function makeRunSettingsFile(settings: DotNetSettings, filter: string) {
	//hidden feature, described here: https://github.com/microsoft/vstest/pull/2356
	const content = `
<RunSettings>
    <RunConfiguration>
        <TestCaseFilter>FullyQualifiedName=Sample.Tests.World.SampleWorldTests.Test_60s_HelloWorld</TestCaseFilter>
    </RunConfiguration>
</RunSettings>
`;
// 	const content = `
// <RunSettings>
//     <RunConfiguration>
//         <TestCaseFilter>${xmlescape(filter)}</TestCaseFilter>
//     </RunConfiguration>
// </RunSettings>
// `;
	
	const path = await pruner.writeToTempFile(
		`${settings.id}.settings`, 
		content.trim());
	return path;
}