import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { checkRateLimit } from '$lib/server/rate-limit';
import { isAdminEmail } from '$lib/server/admin';
import { pool, getGuestStats, getGuestList } from '$lib/server/db';
export const GET: RequestHandler = async ({ request }) => {
 let user;
 try { user = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID); }
 catch { throw error(401, 'Unauthorized'); }
 if (!isAdminEmail(user.email)) throw error(403, 'Forbidden');
 if (!(await checkRateLimit(`admin-stream:${user.sub}`, 20)).allowed) throw error(429, 'Too many connections');
 const encoder = new TextEncoder();
 let timer: ReturnType<typeof setTimeout> | undefined;
 let stopped = false;
 let previous = '';
 const stop = () => { stopped = true; clearTimeout(timer); };
 const stream = new ReadableStream({
  start(controller) {
   const send = async () => {
    if (stopped) return;
    if (user.exp * 1000 <= Date.now()) { stop(); controller.close(); return; }
    try {
     const [result, guests, guestList] = await Promise.all([
      pool.query(`SELECT sub, email, name, plan, plan_expires_at, stripe_customer_id, created_at, last_seen,
      (last_seen > NOW() - INTERVAL '45 seconds') AS online FROM users ORDER BY created_at DESC LIMIT 100`),
      getGuestStats(), getGuestList()
     ]);
     if (stopped) return;
     const data = JSON.stringify({ users: result.rows, guests, guestList });
     controller.enqueue(encoder.encode(data !== previous ? `data: ${data}\n\n` : ': heartbeat\n\n'));
     previous = data;
    } catch { if (!stopped) { stop(); controller.error(new Error('Presence unavailable')); } return; }
    timer = setTimeout(send, 2000);
   };
   request.signal.addEventListener('abort', () => { if (!stopped) { stop(); controller.close(); } }, { once: true });
   void send();
  },
  cancel() { stop(); }
 });
 return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
};
