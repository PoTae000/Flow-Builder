import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateEditLocks, LOCK_LEASE_MS } from '$lib/server/edit-locks';
import { createHash, randomUUID } from 'node:crypto';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const raw = await request.text();
	if (raw.length > 131_072) return json({ message: 'Request too large' }, { status: 413 });
	let body;
	try { body = JSON.parse(raw); } catch { return json({ message: 'Invalid JSON' }, { status: 400 }); }
	if (!body || !/^[a-z0-9]{6}$/.test(body.room ?? '') || typeof body.token !== 'string' || !/^[a-z0-9]{0,64}$/.test(body.token)
		|| typeof body.owner !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.owner)
		|| typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100
		|| !Array.isArray(body.ids) || body.ids.length > 1000
		|| body.ids.some((id: unknown) => typeof id !== 'string' || !id || id.length > 100)) {
		return json({ message: 'Invalid lock request' }, { status: 400 });
	}
	try {
		let secret = cookies.get('flow-lock-session');
		if (!secret || !/^[a-f0-9-]{36}$/.test(secret)) {
			secret = randomUUID();
			cookies.set('flow-lock-session', secret, { path: '/', httpOnly: true, sameSite: 'strict', secure: url.protocol === 'https:' });
		}
		// Public owner IDs cannot be replayed by a different browser to steal/release a lock.
		const owner = createHash('sha256').update(`${secret}:${body.owner}`).digest('hex');
		const locks = await updateEditLocks(body.room, body.token, owner, body.name, [...new Set<string>(body.ids)], body.release === true);
		return json({ locks, self: owner, leaseMs: LOCK_LEASE_MS, serverNow: Date.now() });
	} catch {
		// Never grant a local lock when the shared authority is unavailable.
		return json({ message: 'ไม่สามารถล็อกชิ้นงานได้ กรุณาลองใหม่' }, { status: 503 });
	}
};
