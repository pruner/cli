import DotNetProvider from "./dotnet/DotNetProvider";
import pruner from '../pruner';
import { ProviderClass } from "./types";
import MochaProvider from "./javascript/mocha/MochaProvider";

export const allProviderClasses: ProviderClass[] = [
	DotNetProvider,
	MochaProvider
];

export async function createProvidersFromIdOrNameOrType(provider?: string) {
	const settings = await pruner.readSettings();
	if (!settings)
		return [];

	return settings.providers
		.filter(x =>
			!provider ||
			x.id === provider ||
			x.name === provider ||
			x.type === provider)
		.map(x => ({
			settings: x,
			ProviderClass: allProviderClasses.find(p => p.providerType === x.type)
		}))
		.map(x => new x.ProviderClass(x.settings));
}