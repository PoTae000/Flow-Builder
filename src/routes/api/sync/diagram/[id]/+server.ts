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

	// Delete diagram
	await pool.query(
		'DELETE FROM diagrams WHERE user_sub = $1 AND id = $2',
		[sub, diagramId]
	);

	// Bump version
	const newVersion = Date.now();
	await pool.query(
		`INSERT INTO user_state (user_sub, version)
		 VALUES ($1, $2)
		 ON CONFLICT (user_sub) DO UPDATE SET version = $2`,
		[sub, newVersion]
	);

	return withRateLimitHeaders(json({ ok: true, version: newVersion }), remaining);
};
