

import { pool } from '$lib/server/db';

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
}


const memoryLimits = new Map<string, { count: number; expiresAt: number }>();

function checkMemoryRateLimit(identifier: string, limit: number): RateLimitResult {
	const now = Date.now();
	const entry = memoryLimits.get(identifier);

	if (!entry || entry.expiresAt <= now) {
		memoryLimits.set(identifier, { count: 1, expiresAt: now + 60_000 });
		return { allowed: true, remaining: limit - 1 };
	}

	entry.count++;
	if (entry.count > limit) {
		return { allowed: false, remaining: 0 };
	}
	return { allowed: true, remaining: limit - entry.count };
}

export async function checkRateLimit(
	identifier: string,
	limit: number
): Promise<RateLimitResult> {
	const expiresAt = new Date(Date.now() + 60_000); 

	try {
		
		const result = await pool.query<{ count: number }>(
			`INSERT INTO rate_limits (key, count, expires_at)
			 VALUES ($1, 1, $2)
			 ON CONFLICT (key) DO UPDATE SET
			   count = CASE
			     WHEN rate_limits.expires_at <= NOW() THEN 1
			     ELSE rate_limits.count + 1
			   END,
			   expires_at = CASE
			     WHEN rate_limits.expires_at <= NOW() THEN $2
			     ELSE rate_limits.expires_at
			   END
			 RETURNING count`,
			[identifier, expiresAt]
		);

		const count = result.rows[0].count;

		if (count > limit) {
			return { allowed: false, remaining: 0 };
		}

		return { allowed: true, remaining: limit - count };
	} catch {
		
		return checkMemoryRateLimit(identifier, limit);
	}
}


export async function cleanupExpiredRateLimits(): Promise<void> {
	
	const now = Date.now();
	for (const [key, entry] of memoryLimits) {
		if (entry.expiresAt <= now) memoryLimits.delete(key);
	}

	
	try {
		await pool.query('DELETE FROM rate_limits WHERE expires_at <= NOW()');
	} catch {
		// DB may be unavailable
	}
}
