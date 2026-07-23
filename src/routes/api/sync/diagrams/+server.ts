import { json } from '@sveltejs/kit';
import { authenticateAndRateLimit, withRateLimitHeaders } from '$lib/server/sync-validate';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request);

	const [diagramsResult, stateResult, deletedResult] = await Promise.all([
		pool.query<{ id: string; name: string; diagram_type: string; created_at: string; updated_at: string }>(
			'SELECT id, name, diagram_type, created_at, updated_at FROM diagrams WHERE user_sub = $1',
			[sub]
		),
		pool.query<{ active_diagram_id: string | null }>(
			'SELECT active_diagram_id FROM user_state WHERE user_sub = $1',
			[sub]
		),
		pool.query<{ diagram_id: string; deleted_at: string }>(
			'SELECT diagram_id, deleted_at FROM deleted_diagrams WHERE user_sub = $1',
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

	// Tombstones: authoritative list of diagrams deleted on any device.
	const deleted = deletedResult.rows.map(r => ({
		id: r.diagram_id,
		deletedAt: Number(r.deleted_at)
	}));

	return withRateLimitHeaders(json({ diagrams, active, deleted }), remaining);
};
