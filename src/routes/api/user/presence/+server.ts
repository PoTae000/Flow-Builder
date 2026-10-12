import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { checkRateLimit } from '$lib/server/rate-limit';
import { touchUserSeen, removeGuest, pool } from '$lib/server/db';
import { GUEST_COOKIE, readGuestSession } from '$lib/server/guest-session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	let user;
	try { user = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID); }
	catch { throw error(401, 'Unauthorized'); }
	if (!(await checkRateLimit(`presence:${user.sub}`, 20)).allowed) throw error(429, 'Too many requests');
	await touchUserSeen(user.sub);
	const guest = readGuestSession(cookies.get(GUEST_COOKIE));
	if (guest) await removeGuest(guest);
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	let user;
	try { user = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID); }
	catch { throw error(401, 'Unauthorized'); }
	if (!(await checkRateLimit(`presence:logout:${user.sub}`, 10)).allowed) throw error(429, 'Too many requests');
	await pool.query('UPDATE users SET last_seen = NULL WHERE sub = $1', [user.sub]);
	cookies.delete('pro-access', { path: '/pro' });
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
