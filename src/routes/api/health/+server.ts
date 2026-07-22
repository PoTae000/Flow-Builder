import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const result = await pool.query('SELECT NOW() as time');
		return json({
			status: 'ok',
			database: 'connected',
			time: result.rows[0].time
		});
	} catch (err) {
		// Log details server-side only — pg error messages can leak host/port/db name
		console.error('[health] DB check failed:', err);
		return json({
			status: 'error',
			database: 'disconnected'
		}, { status: 503 });
	}
};
