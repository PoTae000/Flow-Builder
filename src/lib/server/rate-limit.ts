/**
 * KV-based rate limiting with minute-bucket key pattern.
 * Anonymous (by IP): 5 req/min | Authenticated (by sub): 20 req/min
 * If KV is not available (dev mode), allows all requests.
 */

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
}

export async function checkRateLimit(
	kv: KVNamespace | undefined,
	identifier: string,
	limit: number
): Promise<RateLimitResult> {
	// No KV → dev mode, allow all
	if (!kv) {
		return { allowed: true, remaining: limit };
	}

	const minute = Math.floor(Date.now() / 60000);
	const key = `rate:${identifier}:${minute}`;

	try {
		const raw = await kv.get(key);
		const count = raw ? parseInt(raw, 10) : 0;

		if (count >= limit) {
			return { allowed: false, remaining: 0 };
		}

		// Increment counter with 120s TTL (covers current + next minute)
		await kv.put(key, String(count + 1), { expirationTtl: 120 });

		return { allowed: true, remaining: limit - count - 1 };
	} catch {
		// KV error → allow (don't block users due to infra issues)
		return { allowed: true, remaining: limit };
	}
}
