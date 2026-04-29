/**
 * Deep-clone to strip Svelte 5 proxy wrappers.
 * Standalone utility so it can be used by helper modules without accessing CollabState.
 */
export function snap<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}
