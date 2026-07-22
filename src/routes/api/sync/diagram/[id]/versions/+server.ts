import { json, error } from '@sveltejs/kit';
import {
	authenticateAndRateLimit,
	withRateLimitHeaders,
	isValidDiagramId
} from '$lib/server/sync-validate';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request);

	const diagramId = params.id;
	if (!isValidDiagramId(diagramId)) {
		throw error(400, 'Invalid diagram ID format');
	}

	const result = await pool.query(
		`SELECT id, created_at, name, diagram_type
		 FROM diagram_versions
		 WHERE user_sub = $1 AND diagram_id = $2
		 ORDER BY created_at DESC
		 LIMIT 50`,
		[sub, diagramId]
	);

	const versions = result.rows.map((r) => ({
		id: r.id,
		createdAt: Number(r.created_at),
		name: r.name,
		diagramType: r.diagram_type
	}));

	return withRateLimitHeaders(json({ versions }), remaining);
};
