
export function snap<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}
