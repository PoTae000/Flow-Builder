import { json } from '@sveltejs/kit';
import { authenticateAndRateLimit, withRateLimitHeaders } from '$lib/server/sync-validate';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request);

	// Diagram list: try with pinned/tags, fall back to the core columns if the
	// migration hasn't run yet, so a missing column never breaks pull.
	type DiagramRow = { id: string; name: string; diagram_type: string; created_at: string; updated_at: string; pinned?: boolean; tags?: string[] };
	const loadDiagrams = async () => {
		try {
			return await pool.query<DiagramRow>(
				'SELECT id, name, diagram_type, created_at, updated_at, pinned, tags FROM diagrams WHERE user_sub = $1',
				[sub]
			);
		} catch {
			return await pool.query<DiagramRow>(
				'SELECT id, name, diagram_type, created_at, updated_at FROM diagrams WHERE user_sub = $1',
				[sub]
			);
		}
	};

	const [diagramsResult, stateResult, deletedResult] = await Promise.all([
		loadDiagrams(),
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
		updatedAt: Number(r.updated_at),
		pinned: r.pinned === true,
		tags: Array.isArray(r.tags) ? r.tags : []
	}));

	const active = stateResult.rows[0]?.active_diagram_id ?? null;

	// Tombstones: authoritative list of diagrams deleted on any device.
	const deleted = deletedResult.rows.map(r => ({
		id: r.diagram_id,
		deletedAt: Number(r.deleted_at)
	}));

	return withRateLimitHeaders(json({ diagrams, active, deleted }), remaining);
};
