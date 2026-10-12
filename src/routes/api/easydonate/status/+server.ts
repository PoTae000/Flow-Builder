import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { reconcileEasyDonateOrder } from '$lib/server/easydonate';
import { checkRateLimit } from '$lib/server/rate-limit';

export async function POST({ request }: { request: Request }) {
	let user;
	try { user = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID); }
	catch { throw error(401, 'กรุณาเข้าสู่ระบบ'); }
	if (!(await checkRateLimit(`easydonate:check:${user.sub}`, 4)).allowed) throw error(429, 'กรุณารอสักครู่ก่อนตรวจอีกครั้ง');
	const body = await request.json().catch(() => null);
	if (!body || typeof body.id !== 'string' || !/^FB-[A-F0-9]{24}$/.test(body.id)) throw error(400, 'คำสั่งซื้อไม่ถูกต้อง');
	return json(await reconcileEasyDonateOrder(body.id, user.sub), { headers: { 'Cache-Control': 'no-store' } });
}
