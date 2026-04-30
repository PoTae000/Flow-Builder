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
import type { RequestHandler } from './$types';

interface DiagramMetaInput {
	id: string;
	name: string;
	diagramType?: string;
	createdAt: number;
	updatedAt: number;
}

interface PushItem {
	meta: DiagramMetaInput;
	data: Record<string, unknown>;
}

interface FailedItem {
	id: string;
	reason: string;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const kv = platform?.env?.DIAGRAMS_KV;
	if (!kv) throw error(503, 'Cloud sync is not available');

	const { sub, remaining } = await authenticateAndRateLimit(request, platform);

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
		// Get existing cloud meta list
		const existingRaw = await kv.get(`user:${sub}:diagrams`);
		const cloudMetas: DiagramMetaInput[] = existingRaw ? JSON.parse(existingRaw) : [];
		const cloudMap = new Map(cloudMetas.map((m) => [m.id, m]));

		// Merge with per-item validation
		const kvPuts: Promise<void>[] = [];
		const failed: FailedItem[] = [];
		let accepted = 0;

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

			// Check per-user diagram limit (only for new diagrams)
			if (!cloudMap.has(itemId) && cloudMap.size >= MAX_DIAGRAMS_PER_USER) {
				failed.push({ id: itemId, reason: `Maximum ${MAX_DIAGRAMS_PER_USER} diagrams per user` });
				continue;
			}

			const cloudMeta = cloudMap.get(itemId);
			if (!cloudMeta || item.meta.updatedAt >= cloudMeta.updatedAt) {
				cloudMap.set(itemId, item.meta);
				kvPuts.push(kv.put(`user:${sub}:diagram:${itemId}`, JSON.stringify(item.data)));
			}
			accepted++;
		}

		// Save updated meta list
		const mergedMetas = Array.from(cloudMap.values());
		kvPuts.push(kv.put(`user:${sub}:diagrams`, JSON.stringify(mergedMetas)));

		// Save active diagram ID
		if (active) {
			kvPuts.push(kv.put(`user:${sub}:active`, active));
		}

		// Bump version counter using Date.now() to avoid read-increment-write race
		const newVersion = Date.now();
		kvPuts.push(kv.put(`user:${sub}:version`, String(newVersion)));

		await Promise.all(kvPuts);

		const result: Record<string, unknown> = { ok: true, count: accepted, version: newVersion };
		if (failed.length > 0) {
			result.failed = failed;
		}

		return withRateLimitHeaders(json(result), remaining);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('[sync/push] KV error:', err);
		throw error(500, 'Sync push failed');
	}
};
