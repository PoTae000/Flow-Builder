import { json, error, isHttpError } from '@sveltejs/kit';
import {
	authenticateAndRateLimit,
	withRateLimitHeaders,
	isValidDiagramId,
	isValidTimestamp,
	estimateDataSize,
	MAX_DIAGRAMS_PER_PUSH,
	MAX_DIAGRAM_DATA_SIZE,
	MAX_DIAGRAMS_PER_USER
} from '$lib/server/sync-validate';
import { pool, ensureUser } from '$lib/server/db';
import type { RequestHandler } from './$types';

interface DiagramMetaInput {
	id: string;
	name: string;
	diagramType?: string;
	createdAt: number;
	updatedAt: number;
	pinned?: boolean;
	tags?: string[];
}

interface PushItem {
	meta: DiagramMetaInput;
	data: Record<string, unknown>;
}

interface FailedItem {
	id: string;
	reason: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request);

	let body: { diagrams: PushItem[]; active?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { diagrams, active } = body;
	if (!Array.isArray(diagrams)) throw error(400, 'Invalid request body: diagrams must be array');

	if (diagrams.length > MAX_DIAGRAMS_PER_PUSH) {
		throw error(400, `Too many diagrams: max ${MAX_DIAGRAMS_PER_PUSH} per push`);
	}

	// Validate active diagram ID if provided
	if (active !== undefined && active !== null && !isValidDiagramId(active)) {
		throw error(400, 'Invalid active diagram ID format');
	}

	try {
		await ensureUser(sub);

		// Get existing diagram count for limit check
		const countResult = await pool.query<{ count: string }>(
			'SELECT COUNT(*) as count FROM diagrams WHERE user_sub = $1',
			[sub]
		);
		const existingCount = parseInt(countResult.rows[0].count, 10);

		// Get existing diagram IDs for conflict check
		const existingResult = await pool.query<{ id: string; updated_at: string }>(
			'SELECT id, updated_at FROM diagrams WHERE user_sub = $1',
			[sub]
		);
		const existingMap = new Map(existingResult.rows.map(r => [r.id, Number(r.updated_at)]));

		// Get tombstones so a stale device can't resurrect a deleted diagram.
		const tombstoneResult = await pool.query<{ diagram_id: string; deleted_at: string }>(
			'SELECT diagram_id, deleted_at FROM deleted_diagrams WHERE user_sub = $1',
			[sub]
		);
		const tombstoneMap = new Map(tombstoneResult.rows.map(r => [r.diagram_id, Number(r.deleted_at)]));

		const failed: FailedItem[] = [];
		let accepted = 0;
		let newCount = existingCount;

		for (const item of diagrams) {
			if (!item?.meta?.id) {
				failed.push({ id: '<missing>', reason: 'Missing meta.id' });
				continue;
			}

			const itemId = String(item.meta.id);

			if (!isValidDiagramId(itemId)) {
				failed.push({ id: itemId, reason: 'Invalid diagram ID format' });
				continue;
			}

			if (!isValidTimestamp(item.meta.updatedAt)) {
				failed.push({ id: itemId, reason: 'Invalid or future timestamp' });
				continue;
			}

			if (estimateDataSize(item.data) > MAX_DIAGRAM_DATA_SIZE) {
				failed.push({ id: itemId, reason: 'Diagram data exceeds 5MB limit' });
				continue;
			}

			// Tombstone guard: if this diagram was deleted, only accept the push
			// when it's a genuine re-edit made AFTER the deletion. An older push
			// is a stale device resurrecting a deleted diagram — reject it.
			const tombstonedAt = tombstoneMap.get(itemId);
			if (tombstonedAt !== undefined) {
				if (item.meta.updatedAt <= tombstonedAt) {
					failed.push({ id: itemId, reason: 'Diagram was deleted' });
					continue;
				}
				// Newer than the tombstone → user re-created it; clear the tombstone.
				await pool.query(
					'DELETE FROM deleted_diagrams WHERE user_sub = $1 AND diagram_id = $2',
					[sub, itemId]
				);
				tombstoneMap.delete(itemId);
			}

			// Check per-user diagram limit (only for new diagrams)
			if (!existingMap.has(itemId) && newCount >= MAX_DIAGRAMS_PER_USER) {
				failed.push({ id: itemId, reason: `Maximum ${MAX_DIAGRAMS_PER_USER} diagrams per user` });
				continue;
			}

			const existingUpdatedAt = existingMap.get(itemId);
			if (existingUpdatedAt === undefined || item.meta.updatedAt >= existingUpdatedAt) {
				const tagsJson = JSON.stringify(Array.isArray(item.meta.tags) ? item.meta.tags : []);
				await pool.query(
					`INSERT INTO diagrams (id, user_sub, name, diagram_type, data, created_at, updated_at, pinned, tags)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
					 ON CONFLICT (user_sub, id) DO UPDATE SET
					   name = EXCLUDED.name,
					   diagram_type = EXCLUDED.diagram_type,
					   data = EXCLUDED.data,
					   updated_at = EXCLUDED.updated_at,
					   pinned = EXCLUDED.pinned,
					   tags = EXCLUDED.tags`,
					[itemId, sub, item.meta.name || '', item.meta.diagramType || 'er', JSON.stringify(item.data), item.meta.createdAt, item.meta.updatedAt, item.meta.pinned === true, tagsJson]
				);

				if (!existingMap.has(itemId)) newCount++;
				existingMap.set(itemId, item.meta.updatedAt);

				// Auto-save version snapshot
				await pool.query(
					`INSERT INTO diagram_versions (user_sub, diagram_id, data, name, diagram_type, created_at)
					 VALUES ($1, $2, $3, $4, $5, $6)`,
					[sub, itemId, JSON.stringify(item.data), item.meta.name || '', item.meta.diagramType || 'er', item.meta.updatedAt]
				);

				// Prune old versions (keep max 50 per diagram)
				await pool.query(
					`DELETE FROM diagram_versions
					 WHERE user_sub = $1 AND diagram_id = $2
					 AND id NOT IN (
					   SELECT id FROM diagram_versions
					   WHERE user_sub = $1 AND diagram_id = $2
					   ORDER BY created_at DESC LIMIT 50
					 )`, [sub, itemId]
				);
			}
			accepted++;
		}

		// Save active diagram ID + bump version
		const newVersion = Date.now();
		await pool.query(
			`INSERT INTO user_state (user_sub, active_diagram_id, version)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (user_sub) DO UPDATE SET
			   active_diagram_id = COALESCE($2, user_state.active_diagram_id),
			   version = $3`,
			[sub, active || null, newVersion]
		);

		const result: Record<string, unknown> = { ok: true, count: accepted, version: newVersion };
		if (failed.length > 0) {
			result.failed = failed;
		}

		return withRateLimitHeaders(json(result), remaining);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('[sync/push] DB error:', err);
		throw error(500, 'Sync push failed');
	}
};
