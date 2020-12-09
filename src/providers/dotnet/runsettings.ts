import pruner from '../../pruner';
import { DotNetSettings } from './DotNetProvider';

import xmlescape from 'xml-escape';
import _ from 'lodash';
import { join } from 'path';

export async function makeRunSettingsFile(settings: DotNetSettings, filter: string) {
	const environment = settings.environment || {};
	const content = `
<RunSettings>
    <RunConfiguration>
        <TestCaseFilter>${xmlescape(filter)}</TestCaseFilter>
		<EnvironmentVariables>
			${_
			.keys(environment)
			.map(key => ({
				key,
				value: environment[key]
			}))
			.map(tuple =>
				`<${tuple.key}>${xmlescape(tuple.value)}</${tuple.key}>`)
			.join('')}
		</EnvironmentVariables>
	</RunConfiguration>
</RunSettings>
`;

	const path = await pruner.writeToTempFile(
		join(settings.id, "runsettings.settings"),
		content.trim());
	return path;
}
