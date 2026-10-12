import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('$env/static/public', () => ({ PUBLIC_SIGNALING_URL: '' }));
vi.mock('./voice-chat.svelte', () => ({ voiceChat: {} }));
import { CollabState } from './collab.svelte';

function client(owner: string, name: string) {
	const state = new CollabState();
	Object.assign(state, { connected: true, roomId: 'room01', roomToken: 'secret', lockOwner: owner, userName: name });
	return state;
}

describe('editing leases on connected clients', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('allows only one client to edit a piece, while another piece stays available', async () => {
		const leases = new Map<string, { id: string; owner: string; name: string; expiresAt: string }>();
		vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
			const request = JSON.parse(init.body);
			const conflict = request.ids.some((id: string) => leases.has(id) && leases.get(id)!.owner !== request.owner);
			if (!conflict) for (const id of request.ids) leases.set(id, { id, owner: request.owner, name: request.name, expiresAt: new Date(Date.now() + 30_000).toISOString() });
			return Response.json({ locks: [...leases.values()], self: request.owner, serverNow: Date.now() });
		}));
		const alice = client('alice-owner', 'Alice');
		const bob = client('bob-owner', 'Bob');
		const results = await Promise.all([alice.acquireLocks(['piece-a'], false), bob.acquireLocks(['piece-a'], false)]);
		expect(results.filter(Boolean)).toHaveLength(1);
		expect(alice.canEdit('piece-a')).toBe(true);
		expect(bob.canEdit('piece-a')).toBe(false);
		expect(bob.lockLabel('piece-a')).toContain('Alice');
		expect(await bob.acquireLocks(['piece-b'], false)).toBe(true);
	});
	it('fails closed when the authority cannot be reached', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Offline'); }));
		const state = client('owner', 'Alice');
		expect(await state.acquireLocks(['piece'], false)).toBe(false);
		expect(state.canEdit('piece')).toBe(false);
	});
	it('refuses mutation after an owned lease expires', () => {
		const state = client('owner', 'Alice');
		state.editLocks = new Map([['piece', { owner: 'owner', name: 'Alice', until: Date.now() - 1 }]]);
		expect(state.canEdit('piece')).toBe(false);
	});
	it('does not run a mutation when acquisition is denied', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => Response.json({ locks: [{ id: 'piece', owner: 'other', name: 'Alice', expiresAt: new Date(Date.now() + 30_000).toISOString() }], self: 'owner', serverNow: Date.now() })));
		const state = client('owner', 'Bob');
		const mutation = vi.fn();
		expect(await state.runLocked(['piece'], mutation)).toBe(false);
		expect(mutation).not.toHaveBeenCalled();
	});
});
