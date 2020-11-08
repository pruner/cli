import { create, flatMap } from "lodash";
import DotNetProvider from "./dotnet/DotNetProvider";
import pruner from '../pruner';
import { ProviderClass, ProviderSettings } from "./types";

export const allProviderClasses: ProviderClass[] = [DotNetProvider];

export async function createProvidersFromProvider(provider: string) {
	const settings = await pruner.readSettings();

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