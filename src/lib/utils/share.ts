import type { DiagramData } from '$lib/types/session';

/**
 * Compress a string using CompressionStream (deflate).
 * Falls back to raw base64 if CompressionStream is unavailable.
 */
async function compress(input: string): Promise<string> {
	if (typeof CompressionStream === 'undefined') {
		return btoa(unescape(encodeURIComponent(input)));
	}
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(input));
			controller.close();
		}
	}).pipeThrough(new CompressionStream('deflate'));

	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}

	const totalLength = chunks.reduce((s, c) => s + c.length, 0);
	const merged = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.length;
	}

	let binary = '';
	for (let i = 0; i < merged.length; i++) {
		binary += String.fromCharCode(merged[i]);
	}
	return btoa(binary);
}

/**
 * Decompress a base64 string back to the original string.
 */
async function decompress(base64: string): Promise<string> {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	if (typeof DecompressionStream === 'undefined') {
		return decodeURIComponent(escape(binary));
	}

	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		}
	}).pipeThrough(new DecompressionStream('deflate'));

	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}

	const totalLength = chunks.reduce((s, c) => s + c.length, 0);
	const merged = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.length;
	}

	return new TextDecoder().decode(merged);
}

/**
 * Generate a share URL with diagram data encoded in the hash fragment.
 */
export async function generateShareUrl(data: DiagramData): Promise<string> {
	const json = JSON.stringify(data);
	const encoded = await compress(json);
	const base = window.location.origin + window.location.pathname;
	return `${base}#share=${encoded}`;
}

/**
 * Parse share data from the current URL hash.
 * Returns null if no share data is found.
 */
export async function parseShareHash(hash: string): Promise<DiagramData | null> {
	if (!hash.startsWith('#share=')) return null;
	try {
		const encoded = hash.slice('#share='.length);
		const json = await decompress(encoded);
		return JSON.parse(json) as DiagramData;
	} catch {
		return null;
	}
}
