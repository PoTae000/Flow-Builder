import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, release } = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock('./db', () => ({ pool: { query: vi.fn(async () => ({})), connect: vi.fn(async () => ({ query, release })) } }));
import { updateEditLocks } from './edit-locks';

describe('shared editing lock transactions', () => {
	beforeEach(() => { query.mockReset(); release.mockClear(); query.mockResolvedValue({ rows: [], rowCount: 0 }); });
	it('acquires a batch only after the room transaction lock', async () => {
		await updateEditLocks('room01', 'secret', 'Alice', 'Alice', ['node-a', 'node-b']);
		const calls = query.mock.calls.map(c => c[0] as string);
		expect(calls[0]).toBe('BEGIN');
		expect(calls[1]).toContain('pg_advisory_xact_lock');
		expect(calls.findIndex(sql => sql.includes('INSERT INTO'))).toBeGreaterThan(1);
		expect(calls.at(-1)).toBe('COMMIT');
		expect(release).toHaveBeenCalledOnce();
	});
	it('refuses the entire batch if another owner has one of its pieces', async () => {
		query.mockImplementation(async (sql: string) => sql.startsWith('SELECT item_id FROM') ? { rows: [{ item_id: 'node-a' }], rowCount: 1 } : { rows: [], rowCount: 0 });
		await updateEditLocks('room01', 'secret', 'Bob', 'Bob', ['node-a', 'node-b']);
		expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO'))).toBe(false);
	});
	it('releases only pieces belonging to the requesting owner', async () => {
		await updateEditLocks('room01', 'secret', 'Bob', 'Bob', ['node-a'], true);
		const call = query.mock.calls.find(([sql]) => sql.includes('owner_id = $2'));
		expect(call?.[1].slice(1)).toEqual(['Bob', ['node-a']]);
	});
	it('rolls back and returns no grant when the database fails', async () => {
		query.mockRejectedValueOnce(new Error('Database unavailable'));
		await expect(updateEditLocks('room01', 'secret', 'Alice', 'Alice', ['node-a'])).rejects.toThrow('Database unavailable');
		expect(query).toHaveBeenCalledWith('ROLLBACK');
		expect(release).toHaveBeenCalledOnce();
	});
});
