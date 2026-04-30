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

	const body: any = await request.json();
	const ids = body?.ids;

	if (!Array.isArray(ids) || !ids.every((id: unknown) => typeof id === 'string')) {
		throw error(400, 'Invalid request body: ids must be a string array');
	}

	if (ids.length > MAX_IDS_PER_PULL) {
		throw error(400, `Too many IDs: max ${MAX_IDS_PER_PULL} per pull`);
	}

	// Filter out invalid IDs silently (read operation)
	const validIds = ids.filter((id: string) => isValidDiagramId(id));

	// Fetch all requested diagram data in parallel — handle per-entry errors
	const entries = await Promise.all(
		validIds.map(async (id: string) => {
			try {
				const raw = await kv.get(`user:${sub}:diagram:${id}`);
				return [id, raw ? JSON.parse(raw) : null] as const;
			} catch {
				// Skip corrupted entries instead of crashing the entire request
				return [id, null] as const;
			}
		})
	);

	const diagrams: Record<string, unknown> = {};
	for (const [id, data] of entries) {
		if (data) diagrams[id] = data;
	}

	return withRateLimitHeaders(json({ diagrams }), remaining);
};
