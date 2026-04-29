import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from './rate-limit';

function createMockKV() {
	const store = new Map<string, { value: string; expiry: number }>();
	return {
		get: vi.fn(async (key: string) => {
			const entry = store.get(key);
			if (!entry) return null;
			if (Date.now() > entry.expiry) {
				store.delete(key);
				return null;
			}
			return entry.value;
		}),
		put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
			const ttl = opts?.expirationTtl || 120;
			store.set(key, { value, expiry: Date.now() + ttl * 1000 });
		}),
		_store: store
	} as unknown as KVNamespace & { _store: Map<string, { value: string; expiry: number }> };
}

describe('checkRateLimit', () => {
	let kv: ReturnType<typeof createMockKV>;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('allows requests under the limit', async () => {
		const result = await checkRateLimit(kv, 'user:123', 5);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(4);
	});

	it('blocks requests over the limit', async () => {
		// Exhaust the limit
		for (let i = 0; i < 5; i++) {
			await checkRateLimit(kv, 'user:123', 5);
		}

		const result = await checkRateLimit(kv, 'user:123', 5);
		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
	});

	it('uses different limits for anon vs auth', async () => {
		// Anonymous: limit 5
		for (let i = 0; i < 5; i++) {
			await checkRateLimit(kv, 'ip:1.2.3.4', 5);
		}
		const anonResult = await checkRateLimit(kv, 'ip:1.2.3.4', 5);
		expect(anonResult.allowed).toBe(false);

		// Authenticated: limit 20, separate identifier
		for (let i = 0; i < 5; i++) {
			await checkRateLimit(kv, 'sub:google123', 20);
		}
		const authResult = await checkRateLimit(kv, 'sub:google123', 20);
		expect(authResult.allowed).toBe(true);
		expect(authResult.remaining).toBe(14);
	});

	it('gracefully allows when KV is undefined (dev mode)', async () => {
		const result = await checkRateLimit(undefined, 'anyone', 5);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(5);
	});

	it('gracefully allows when KV throws an error', async () => {
		const brokenKV = {
			get: vi.fn(async () => { throw new Error('KV is down'); }),
			put: vi.fn(async () => { throw new Error('KV is down'); })
		} as unknown as KVNamespace;

		const result = await checkRateLimit(brokenKV, 'user:123', 5);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(5);
	});

	it('decrements remaining count correctly', async () => {
		const r1 = await checkRateLimit(kv, 'user:x', 3);
		expect(r1.remaining).toBe(2);

		const r2 = await checkRateLimit(kv, 'user:x', 3);
		expect(r2.remaining).toBe(1);

		const r3 = await checkRateLimit(kv, 'user:x', 3);
		expect(r3.remaining).toBe(0);

		const r4 = await checkRateLimit(kv, 'user:x', 3);
		expect(r4.allowed).toBe(false);
	});
});
