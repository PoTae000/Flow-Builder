import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recordGuestPing, removeGuest } from '$lib/server/db';
import { checkRateLimit } from '$lib/server/rate-limit';
import { GUEST_COOKIE, issueGuestSession, readGuestSession, guestRequestAllowed } from '$lib/server/guest-session';

const rejected = () => json({ message: 'เรียกใช้งานถี่เกินไป กรุณารอสักครู่' }, { status: 429, headers: { 'Retry-After': '60' } });
export const POST: RequestHandler = async ({ cookies, getClientAddress, url }) => {
 const ip = getClientAddress(); // Only trust adapter-configured client address, never arbitrary request headers.
 if (!guestRequestAllowed(ip)) return rejected();
 let id = readGuestSession(cookies.get(GUEST_COOKIE));
 if (!id) {
  if (!(await checkRateLimit(`guest-create:${ip}`, 5)).allowed) return rejected();
  const value = issueGuestSession(); id = readGuestSession(value)!;
  cookies.set(GUEST_COOKIE, value, { path: '/', httpOnly: true, sameSite: 'strict', secure: url.protocol === 'https:', maxAge: 30 * 86400 });
 }
 if (!(await checkRateLimit(`guest:${id}`, 6)).allowed) return rejected();
 try { await recordGuestPing(id); }
 catch { return json({ message: 'ระบบยังไม่พร้อม กรุณาลองใหม่' }, { status: 503 }); }
 return json({ ok: true });
};
export const DELETE: RequestHandler = async ({ cookies, getClientAddress }) => {
 if (!guestRequestAllowed(getClientAddress())) return rejected();
 const id = readGuestSession(cookies.get(GUEST_COOKIE));
 if (!id) return json({ ok: true });
 if (!(await checkRateLimit(`guest-delete:${id}`, 3)).allowed) return rejected();
 await removeGuest(id);
 // Keep the signed identity so logout/re-entry cannot generate unlimited rows.
 return json({ ok: true });
};
