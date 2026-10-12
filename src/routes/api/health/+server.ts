import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db';
import { checkRateLimit } from '$lib/server/rate-limit';
import { getClientIp } from '$lib/server/ai-request';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, getClientAddress }) => {
	// Rate-limit per IP so a flood can't exhaust the shared DB connection pool.
	const ip = getClientIp(request) || getClientAddress();
	const { allowed } = await checkRateLimit(`health:${ip}`, 60);
	if (!allowed) {
		return json({ status: 'rate_limited' }, { status: 429 });
	}

	try {
		await pool.query('SELECT 1');
		return json({ status: 'ok', database: 'connected' });
	} catch (err) {
		console.error('[health] DB check failed:', err);
		return json({ status: 'error', database: 'disconnected' }, { status: 503 });
	}
};
