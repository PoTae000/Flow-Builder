import { json } from '@sveltejs/kit';
import { authenticateAndRateLimit, withRateLimitHeaders, VERSION_RATE_LIMIT } from '$lib/server/sync-validate';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request, { bucket: 'sync-version', limit: VERSION_RATE_LIMIT });

	const result = await pool.query<{ version: string }>(
		'SELECT version FROM user_state WHERE user_sub = $1',
		[sub]
	);

	const version = result.rows[0] ? Number(result.rows[0].version) : 0;

	return withRateLimitHeaders(json({ version }), remaining);
};
