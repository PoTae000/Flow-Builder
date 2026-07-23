import { json, error } from '@sveltejs/kit';
import {
	authenticateAndRateLimit,
	withRateLimitHeaders,
	isValidDiagramId
} from '$lib/server/sync-validate';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, params }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request);

	const diagramId = params.id;
	if (!isValidDiagramId(diagramId)) {
		throw error(400, 'Invalid diagram ID format');
	}

	const newVersion = Date.now();

	// Delete diagram + write tombstone so other devices delete it too
	// (instead of resurrecting it on their next sync).
	await pool.query(
		'DELETE FROM diagrams WHERE user_sub = $1 AND id = $2',
		[sub, diagramId]
	);
	await pool.query(
		`INSERT INTO deleted_diagrams (user_sub, diagram_id, deleted_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_sub, diagram_id) DO UPDATE SET deleted_at = $3`,
		[sub, diagramId, newVersion]
	);

	// Bump version
	await pool.query(
		`INSERT INTO user_state (user_sub, version)
		 VALUES ($1, $2)
		 ON CONFLICT (user_sub) DO UPDATE SET version = $2`,
		[sub, newVersion]
	);

	return withRateLimitHeaders(json({ ok: true, version: newVersion }), remaining);
};
