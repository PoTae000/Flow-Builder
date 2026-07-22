import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing rate-limit
vi.mock('$lib/server/db', () => {
	const mockQuery = vi.fn();
	return {
		pool: { query: mockQuery }
	};
});

// Mock $env/static/private
vi.mock('$env/static/private', () => ({
	DATABASE_URL: 'postgresql://test@localhost/test'
}));

import { checkRateLimit } from './rate-limit';
import { pool } from '$lib/server/db';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

describe('checkRateLimit', () => {
	beforeEach(() => {
		mockQuery.mockReset();
	});

	it('allows requests under the limit', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const result = await checkRateLimit('user:123', 5);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(4);
	});

	it('blocks requests over the limit', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 6 }] });

		const result = await checkRateLimit('user:123', 5);
		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
	});

	it('blocks when exactly at the limit', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 6 }] });

		const result = await checkRateLimit('user:123', 5);
		expect(result.allowed).toBe(false);
	});

	it('allows when count equals limit', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] });

		const result = await checkRateLimit('user:123', 5);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(0);
	});

	it('denies on database error', async () => {
		mockQuery.mockRejectedValueOnce(new Error('DB is down'));

		const result = await checkRateLimit('user:123', 5);
		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
	});

	it('decrements remaining count correctly', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		const r1 = await checkRateLimit('user:x', 3);
		expect(r1.remaining).toBe(2);

		mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] });
		const r2 = await checkRateLimit('user:x', 3);
		expect(r2.remaining).toBe(1);

		mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] });
		const r3 = await checkRateLimit('user:x', 3);
		expect(r3.remaining).toBe(0);

		mockQuery.mockResolvedValueOnce({ rows: [{ count: 4 }] });
		const r4 = await checkRateLimit('user:x', 3);
		expect(r4.allowed).toBe(false);
	});
});
