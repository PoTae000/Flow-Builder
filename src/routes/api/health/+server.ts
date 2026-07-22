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
		return json({
			status: 'error',
			database: 'disconnected',
			message: err instanceof Error ? err.message : 'Unknown error'
		}, { status: 503 });
	}
};
