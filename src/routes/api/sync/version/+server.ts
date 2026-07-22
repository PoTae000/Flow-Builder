import { json } from '@sveltejs/kit';
import { authenticateAndRateLimit, withRateLimitHeaders } from '$lib/server/sync-validate';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request);

	const result = await pool.query<{ version: string }>(
		'SELECT version FROM user_state WHERE user_sub = $1',
		[sub]
	);

	const version = result.rows[0] ? Number(result.rows[0].version) : 0;

	return withRateLimitHeaders(json({ version }), remaining);
};
