import { error, json } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	let user;
	try { user = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID); }
	catch { throw error(401, 'กรุณาเข้าสู่ระบบ'); }
	cookies.set('pro-access', request.headers.get('authorization')!.slice(7), {
		path: '/pro', httpOnly: true, secure: url.protocol === 'https:', sameSite: 'strict',
		maxAge: Math.max(0, Math.min(3600, user.exp - Math.floor(Date.now() / 1000)))
	});
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete('pro-access', { path: '/pro' });
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
