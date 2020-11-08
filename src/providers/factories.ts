import { flatMap } from "lodash";
import DotNetProvider from "./dotnet/DotNetProvider";
import io from '../io';
import { ProviderClass, ProviderSettings } from "./types";

export const allProviders: ProviderClass<any>[] = [DotNetProvider];

export async function createProvidersFromArguments(providerName: string) {
    const classes = providerName ?
        [allProviders.find(x => x.providerName === providerName)] :
        allProviders;

    const providers = await Promise.all(classes.map(createProvidersFromClass));
    return flatMap(providers);
}

async function createProvidersFromClass(Provider: ProviderClass) {
    const settings = JSON.parse(
        await io.readFromPrunerFile('settings.json'));

    const providerSettings = settings[Provider.providerName] as ProviderSettings[];

    return providerSettings.map(
        settings => new Provider(settings));
}