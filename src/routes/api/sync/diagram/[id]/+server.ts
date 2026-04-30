import { json, error } from '@sveltejs/kit';
import {
	authenticateAndRateLimit,
	withRateLimitHeaders,
	isValidDiagramId
} from '$lib/server/sync-validate';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, platform, params }) => {
	const kv = platform?.env?.DIAGRAMS_KV;
	if (!kv) throw error(503, 'Cloud sync is not available');

	const { sub, remaining } = await authenticateAndRateLimit(request, platform);

	const diagramId = params.id;
	if (!isValidDiagramId(diagramId)) {
		throw error(400, 'Invalid diagram ID format');
	}

	// Delete diagram data
	await kv.delete(`user:${sub}:diagram:${diagramId}`);

	// Remove from meta list
	const metaRaw = await kv.get(`user:${sub}:diagrams`);
	if (metaRaw) {
		let metas: Array<{ id: string }>;
		try { metas = JSON.parse(metaRaw); } catch { metas = []; }
		const filtered = metas.filter((m) => m.id !== diagramId);
		await kv.put(`user:${sub}:diagrams`, JSON.stringify(filtered));
	}

	// Bump version counter using Date.now() to avoid read-increment-write race
	const newVersion = Date.now();
	await kv.put(`user:${sub}:version`, String(newVersion));

	return withRateLimitHeaders(json({ ok: true, version: newVersion }), remaining);
};
