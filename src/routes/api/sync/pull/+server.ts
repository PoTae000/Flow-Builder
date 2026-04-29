import { json, error } from '@sveltejs/kit';
import {
	authenticateAndRateLimit,
	withRateLimitHeaders,
	isValidDiagramId,
	MAX_IDS_PER_PULL
} from '$lib/server/sync-validate';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const kv = platform?.env?.DIAGRAMS_KV;
	if (!kv) throw error(503, 'Cloud sync is not available');

	const { sub, remaining } = await authenticateAndRateLimit(request, platform);

	const body = await request.json();
	const { ids } = body as { ids: string[] };

	if (!Array.isArray(ids)) throw error(400, 'Invalid request body');

	if (ids.length > MAX_IDS_PER_PULL) {
		throw error(400, `Too many IDs: max ${MAX_IDS_PER_PULL} per pull`);
	}

	// Filter out invalid IDs silently (read operation)
	const validIds = ids.filter((id) => isValidDiagramId(id));

	// Fetch all requested diagram data in parallel
	const entries = await Promise.all(
		validIds.map(async (id) => {
			const raw = await kv.get(`user:${sub}:diagram:${id}`);
			return [id, raw ? JSON.parse(raw) : null] as const;
		})
	);

	const diagrams: Record<string, unknown> = {};
	for (const [id, data] of entries) {
		if (data) diagrams[id] = data;
	}

	return withRateLimitHeaders(json({ diagrams }), remaining);
};
