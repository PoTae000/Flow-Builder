/**
 * KV-based rate limiting with minute-bucket key pattern.
 * Anonymous (by IP): 5 req/min | Authenticated (by sub): 20 req/min
 * Fail-closed: if KV is unavailable or errors, requests are denied (unless dev mode).
 *
 * KNOWN LIMITATION (H1 — TOCTOU race):
 * The KV get-then-put pattern is not atomic. Under high concurrency, multiple
 * requests may read the same counter value before any of them writes the
 * incremented value, allowing a brief burst above the limit. This is accepted
 * because:
 * 1. It's a soft/best-effort limit — the Groq API has its own rate limiting
 *    as a backstop, so overshoot doesn't cause unbounded cost.
 * 2. Cloudflare Durable Objects would provide atomic counters but add significant
 *    complexity and cost for marginal improvement.
 * 3. The window is small (fraction of a second) and exploiting it requires
 *    precise concurrent timing with minimal practical benefit.
 */

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
}

let _devMode = false;

/** Enable dev mode to allow requests when KV is unavailable. */
export function enableDevMode() {
	_devMode = true;
}

export async function checkRateLimit(
	kv: KVNamespace | undefined,
	identifier: string,
	limit: number
): Promise<RateLimitResult> {
	// No KV → fail closed unless explicitly in dev mode
	if (!kv) {
		if (_devMode) {
			return { allowed: true, remaining: limit };
		}
		return { allowed: false, remaining: 0 };
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
	} catch (err) {
		// KV error → fail closed (deny request)
		console.error('Rate limit KV error:', err);
		return { allowed: false, remaining: 0 };
	}
}
