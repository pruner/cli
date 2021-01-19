import con from './console';

export async function delay(milliseconds: number) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function measureTime<T>(title: string, action: () => Promise<T> | T) {
	const now = new Date();
	const result = await Promise.resolve(action());

	const time = (new Date().getTime()) - now.getTime();
	con.debug(() => ["performance", title, time]);

	return result;
}