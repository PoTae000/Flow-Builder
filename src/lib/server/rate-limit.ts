/**
 * PostgreSQL-based rate limiting with atomic UPSERT.
 * Anonymous (by IP): 5 req/min | Authenticated (by sub): 20 req/min
 * Uses INSERT ON CONFLICT to avoid TOCTOU race conditions.
 * Falls back to in-memory Map when DB is unavailable.
 */

import { pool } from '$lib/server/db';

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
}

// In-memory fallback when DB is unavailable
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
	const expiresAt = new Date(Date.now() + 60_000); // 1 minute from now

	try {
		// Atomic upsert: insert or increment, reset if expired
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
		// DB unavailable — use in-memory fallback (still enforces limits)
		return checkMemoryRateLimit(identifier, limit);
	}
}

/** Clean up expired rate limit entries (call periodically or on startup) */
export async function cleanupExpiredRateLimits(): Promise<void> {
	// Clean in-memory fallback
	const now = Date.now();
	for (const [key, entry] of memoryLimits) {
		if (entry.expiresAt <= now) memoryLimits.delete(key);
	}

	// Clean DB
	try {
		await pool.query('DELETE FROM rate_limits WHERE expires_at <= NOW()');
	} catch {
		// DB may be unavailable
	}
}
