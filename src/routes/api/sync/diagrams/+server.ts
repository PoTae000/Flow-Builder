import { json, error } from '@sveltejs/kit';
import { authenticateAndRateLimit, withRateLimitHeaders } from '$lib/server/sync-validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform }) => {
	const kv = platform?.env?.DIAGRAMS_KV;
	if (!kv) throw error(503, 'Cloud sync is not available');

	const { sub, remaining } = await authenticateAndRateLimit(request, platform);

	const [metaRaw, activeRaw] = await Promise.all([
		kv.get(`user:${sub}:diagrams`),
		kv.get(`user:${sub}:active`)
	]);

	return withRateLimitHeaders(
		json({
			diagrams: metaRaw ? (() => { try { return JSON.parse(metaRaw); } catch { return []; } })() : [],
			active: activeRaw ?? null
		}),
		remaining
	);
};
