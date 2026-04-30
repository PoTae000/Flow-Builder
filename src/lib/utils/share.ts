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

const MAX_ENCODED_SIZE = 500 * 1024; // 500KB
const MAX_DECOMPRESSED_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ENTITIES = 500;
const MAX_RELATIONSHIPS = 1000;

/**
 * Parse share data from the current URL hash.
 * Returns null if no share data is found or validation fails.
 */
export async function parseShareHash(hash: string): Promise<DiagramData | null> {
	if (!hash.startsWith('#share=')) return null;
	try {
		const encoded = hash.slice('#share='.length);

		// Size check on encoded data
		if (encoded.length > MAX_ENCODED_SIZE) return null;

		const jsonStr = await decompress(encoded);

		// Size check on decompressed data
		if (jsonStr.length > MAX_DECOMPRESSED_SIZE) return null;

		const data = JSON.parse(jsonStr);

		// Schema validation
		if (!data || typeof data !== 'object') return null;
		if (!Array.isArray(data.entities) || !Array.isArray(data.relationships)) return null;
		if (typeof data.notation !== 'string') return null;
		if (data.entities.length > MAX_ENTITIES) return null;
		if (data.relationships.length > MAX_RELATIONSHIPS) return null;

		return data as DiagramData;
	} catch {
		return null;
	}
}
