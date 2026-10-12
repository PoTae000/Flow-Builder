import { json, error, isHttpError } from '@sveltejs/kit';
import { authenticateAndRateLimit, withRateLimitHeaders } from '$lib/server/sync-validate';
import { pool, ensureUser } from '$lib/server/db';
import { kickOtherDevices } from '$lib/server/sync-events';
import type { RequestHandler } from './$types';


export const POST: RequestHandler = async ({ request }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request, {
		bucket: 'sync-claim',
		limit: 30
	});

	let body: { deviceId?: string; label?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 64) : '';
	const label = typeof body.label === 'string' ? body.label.slice(0, 60) : 'another device';
	if (!deviceId) throw error(400, 'Missing deviceId');

	try {
		await ensureUser(sub);

		const now = Date.now();
		
		
		await pool.query(
			`INSERT INTO user_state (user_sub, active_device, active_device_label, active_device_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (user_sub) DO UPDATE SET
			   active_device = $2,
			   active_device_label = $3,
			   active_device_at = $4`,
			[sub, deviceId, label, now]
		);

		
		kickOtherDevices(sub, deviceId, label);

		return withRateLimitHeaders(json({ ok: true, activeDevice: deviceId, at: now }), remaining);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('[sync/claim] DB error:', err);
		throw error(500, 'Claim failed');
	}
};
