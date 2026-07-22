import { json } from '@sveltejs/kit';
import { authenticateAndRateLimit, withRateLimitHeaders } from '$lib/server/sync-validate';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request);

	const [diagramsResult, stateResult] = await Promise.all([
		pool.query<{ id: string; name: string; diagram_type: string; created_at: string; updated_at: string }>(
			'SELECT id, name, diagram_type, created_at, updated_at FROM diagrams WHERE user_sub = $1',
			[sub]
		),
		pool.query<{ active_diagram_id: string | null }>(
			'SELECT active_diagram_id FROM user_state WHERE user_sub = $1',
			[sub]
		)
	]);

	const diagrams = diagramsResult.rows.map(r => ({
		id: r.id,
		name: r.name,
		diagramType: r.diagram_type,
		createdAt: Number(r.created_at),
		updatedAt: Number(r.updated_at)
	}));

	const active = stateResult.rows[0]?.active_diagram_id ?? null;

	return withRateLimitHeaders(json({ diagrams, active }), remaining);
};
