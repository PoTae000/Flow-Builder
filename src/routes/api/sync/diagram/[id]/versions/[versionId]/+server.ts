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
	const versionId = parseInt(params.versionId, 10);

	if (!isValidDiagramId(diagramId)) {
		throw error(400, 'Invalid diagram ID format');
	}
	if (!Number.isFinite(versionId) || versionId <= 0) {
		throw error(400, 'Invalid version ID');
	}

	const result = await pool.query(
		`SELECT data FROM diagram_versions
		 WHERE id = $1 AND user_sub = $2 AND diagram_id = $3`,
		[versionId, sub, diagramId]
	);

	if (result.rows.length === 0) {
		throw error(404, 'Version not found');
	}

	return withRateLimitHeaders(json({ data: result.rows[0].data }), remaining);
};

export const POST: RequestHandler = async ({ request, params }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request);

	const diagramId = params.id;
	const versionId = parseInt(params.versionId, 10);

	if (!isValidDiagramId(diagramId)) {
		throw error(400, 'Invalid diagram ID format');
	}
	if (!Number.isFinite(versionId) || versionId <= 0) {
		throw error(400, 'Invalid version ID');
	}

	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		// Fetch version data
		const versionResult = await client.query(
			`SELECT data, name, diagram_type FROM diagram_versions
			 WHERE id = $1 AND user_sub = $2 AND diagram_id = $3`,
			[versionId, sub, diagramId]
		);

		if (versionResult.rows.length === 0) {
			await client.query('ROLLBACK');
			throw error(404, 'Version not found');
		}

		const { data, name, diagram_type } = versionResult.rows[0];
		const now = Date.now();

		// Update current diagram with version data
		await client.query(
			`UPDATE diagrams SET data = $1, name = $2, diagram_type = $3, updated_at = $4
			 WHERE user_sub = $5 AND id = $6`,
			[JSON.stringify(data), name, diagram_type, now, sub, diagramId]
		);

		// Create new version entry for the restore action
		await client.query(
			`INSERT INTO diagram_versions (user_sub, diagram_id, data, name, diagram_type, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[sub, diagramId, JSON.stringify(data), name, diagram_type, now]
		);

		// Bump user version
		const newVersion = now;
		await client.query(
			`INSERT INTO user_state (user_sub, version)
			 VALUES ($1, $2)
			 ON CONFLICT (user_sub) DO UPDATE SET version = $2`,
			[sub, newVersion]
		);

		await client.query('COMMIT');

		return withRateLimitHeaders(
			json({ ok: true, version: newVersion, data, name, diagramType: diagram_type }),
			remaining
		);
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
};
