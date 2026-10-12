import type { DiagramData } from '$lib/types/session';


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


export async function generateShareUrl(data: DiagramData, token?: string | null): Promise<string> {
	const origin = window.location.origin;
	const json = JSON.stringify(data);

	if (token) {
		try {
			const res = await fetch('/api/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: json
			});
			if (res.ok) {
				const { id } = await res.json();
				if (id) return `${origin}/?s=${id}`;
			}
		} catch {
			// Network/server failure — fall through to the inline hash scheme.
		}
	}

	
	const encoded = await compress(json);
	return `${origin}/#share=${encoded}`;
}


export async function resolveShareData(search: string, hash: string): Promise<DiagramData | null> {
	const params = new URLSearchParams(search);
	const id = params.get('s');
	if (id && /^[A-Za-z0-9]{1,32}$/.test(id)) {
		try {
			const res = await fetch(`/api/share/${id}`);
			if (!res.ok) return null;
			const data = await res.json();
			return validateShareData(data);
		} catch {
			return null;
		}
	}
	return parseShareHash(hash);
}

const MAX_ENCODED_SIZE = 500 * 1024; 
const MAX_DECOMPRESSED_SIZE = 2 * 1024 * 1024; 
const MAX_ENTITIES = 500;
const MAX_RELATIONSHIPS = 1000;


function validateShareData(data: unknown): DiagramData | null {
	if (!data || typeof data !== 'object') return null;
	const d = data as Record<string, unknown>;
	if (!Array.isArray(d.entities) || !Array.isArray(d.relationships)) return null;
	if (typeof d.notation !== 'string') return null;
	if (d.entities.length > MAX_ENTITIES) return null;
	if (d.relationships.length > MAX_RELATIONSHIPS) return null;
	return data as DiagramData;
}


export async function parseShareHash(hash: string): Promise<DiagramData | null> {
	if (!hash.startsWith('#share=')) return null;
	try {
		const encoded = hash.slice('#share='.length);

		
		if (encoded.length > MAX_ENCODED_SIZE) return null;

		const jsonStr = await decompress(encoded);

		
		if (jsonStr.length > MAX_DECOMPRESSED_SIZE) return null;

		return validateShareData(JSON.parse(jsonStr));
	} catch {
		return null;
	}
}
