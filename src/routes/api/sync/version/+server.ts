import { json } from '@sveltejs/kit';
import { authenticateAndRateLimit, withRateLimitHeaders, VERSION_RATE_LIMIT } from '$lib/server/sync-validate';
import { pool, touchUserSeen } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const { sub, remaining } = await authenticateAndRateLimit(request, { bucket: 'sync-version', limit: VERSION_RATE_LIMIT });

	
	
	
	void touchUserSeen(sub).catch(() => {});

	const result = await pool.query<{
		version: string;
		active_device: string | null;
		active_device_label: string | null;
	}>(
		'SELECT version, active_device, active_device_label FROM user_state WHERE user_sub = $1',
		[sub]
	);

	const row = result.rows[0];
	const version = row ? Number(row.version) : 0;
	
	
	
	
	const activeDevice = row?.active_device ?? null;
	const activeDeviceLabel = row?.active_device_label ?? null;

	return withRateLimitHeaders(
		json({ version, activeDevice, activeDeviceLabel }),
		remaining
	);
};
