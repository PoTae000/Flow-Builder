import { json, error } from '@sveltejs/kit';
import {
	authenticateAndRateLimit,
	withRateLimitHeaders,
	isValidDiagramId,
	MAX_IDS_PER_PULL
} from '$lib/server/sync-validate';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request);

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

	if (validIds.length === 0) {
		return withRateLimitHeaders(json({ diagrams: {} }), remaining);
	}

	const result = await pool.query<{ id: string; data: unknown }>(
		'SELECT id, data FROM diagrams WHERE user_sub = $1 AND id = ANY($2)',
		[sub, validIds]
	);

	const diagrams: Record<string, unknown> = {};
	for (const row of result.rows) {
		diagrams[row.id] = row.data;
	}

	return withRateLimitHeaders(json({ diagrams }), remaining);
};
