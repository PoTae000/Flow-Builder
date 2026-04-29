import { json, error } from '@sveltejs/kit';
import { authenticateAndRateLimit, withRateLimitHeaders } from '$lib/server/sync-validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform }) => {
	const kv = platform?.env?.DIAGRAMS_KV;
	if (!kv) throw error(503, 'Cloud sync is not available');

	const { sub, remaining } = await authenticateAndRateLimit(request, platform);

	const raw = await kv.get(`user:${sub}:version`);
	const version = raw ? parseInt(raw, 10) : 0;

	return withRateLimitHeaders(json({ version }), remaining);
};
