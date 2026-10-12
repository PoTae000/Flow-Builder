import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { pool } from './db';
import { checkRateLimit } from './rate-limit';
import { donationItems, matchesPaidDonation, type EasyDonateOrder } from './easydonate-validation';

export function easyDonateConfig() {
	let pageUrl = '';
	try {
		const url = new URL(env.EASYDONATE_PAGE_URL ?? '');
		if (url.protocol === 'https:' && ['easydonate.app', 'ezdn.app'].includes(url.hostname) && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
			&& !['dashboard', 'login', 'register'].includes(url.pathname.split('/')[1]) && !url.username && !url.password) {
			pageUrl = `${url.origin}${url.pathname}`;
		}
	} catch { /* Missing configuration keeps checkout disabled. */ }
	return {
		// Enable only after validating real API records with the merchant account.
		available: !!pageUrl && !!env.EASYDONATE_API_KEY && !!env.EASYDONATE_WEBHOOK_SECRET && env.EASYDONATE_VERIFIED_SCHEMA === 'true',
		pageUrl, amount: 24900, currency: 'thb', interval: 'month', intervalCount: 1,
		provider: 'easydonate', testMode: false
	};
}

export function validWebhookSecret(value: string | null) {
	if (!value || !env.EASYDONATE_WEBHOOK_SECRET) return false;
	const hash = (s: string) => createHash('sha256').update(s).digest();
	return timingSafeEqual(hash(value), hash(env.EASYDONATE_WEBHOOK_SECRET));
}

export async function createEasyDonateOrder(userSub: string) {
	const config = easyDonateConfig();
	if (!config.available) throw error(503, 'EasyDonate ยังไม่ได้ตั้งค่าและทดสอบรับเงินจริง');
	if (!(await checkRateLimit(`easydonate:create:${userSub}`, 5)).allowed) throw error(429, 'กรุณารอก่อนสร้างรายการใหม่');
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('SELECT sub FROM users WHERE sub = $1 FOR UPDATE', [userSub]);
		const existing = await client.query("SELECT * FROM payment_orders WHERE user_sub = $1 AND provider = 'easydonate' AND status = 'pending' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1", [userSub]);
		let order = existing.rows[0];
		if (!order) {
			const id = `FB-${randomBytes(12).toString('hex').toUpperCase()}`;
			const result = await client.query("INSERT INTO payment_orders (id, user_sub, amount_satang, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours') RETURNING *", [id, userSub, config.amount]);
			order = result.rows[0];
		}
		await client.query('COMMIT');
		return { id: order.id, amount: order.amount_satang, expiresAt: order.expires_at, pageUrl: config.pageUrl };
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally { client.release(); }
}

export async function reconcileEasyDonateOrder(id: string, userSub?: string) {
	if (!easyDonateConfig().available) throw error(503, 'EasyDonate ยังไม่พร้อม');
	const found = await pool.query("SELECT * FROM payment_orders WHERE id = $1 AND provider = 'easydonate'" + (userSub ? ' AND user_sub = $2' : ''), userSub ? [id, userSub] : [id]);
	const order = found.rows[0] as (EasyDonateOrder & { user_sub: string; status: string; pro_expires_at: Date }) | undefined;
	if (!order) throw error(404, 'ไม่พบคำสั่งซื้อ');
	if (order.status === 'paid') return { status: 'paid', expiresAt: order.pro_expires_at };
	// A global limit also protects the merchant's 60 requests/minute API quota.
	if (!(await checkRateLimit('easydonate:api', 40)).allowed) throw error(429, 'ระบบกำลังตรวจหลายรายการ กรุณาลองใหม่');
	const url = new URL('https://api.easydonate.app/api/v1/donations/search');
	url.searchParams.set('search', id);
	url.searchParams.set('size', '100');
	let response: Response;
	try {
		response = await fetch(url, { headers: { Authorization: `Bearer ${env.EASYDONATE_API_KEY}` }, signal: AbortSignal.timeout(10_000), redirect: 'error' });
	} catch { throw error(502, 'เชื่อมต่อ API EasyDonate ไม่สำเร็จ (ED_NETWORK)'); }
	if (response.status === 401 || response.status === 403) throw error(502, 'API key EasyDonate ใช้ไม่ได้หรือไม่มีสิทธิ์ read:donations (ED_AUTH)');
	if (response.status === 429) throw error(429, 'EasyDonate จำกัดจำนวนการตรวจยอด กรุณารอสักครู่ (ED_RATE_LIMIT)');
	if (!response.ok) throw error(502, `API EasyDonate ตอบกลับ HTTP ${response.status} (ED_UPSTREAM)`);
	let payments: unknown[];
	try { payments = donationItems(await response.json()); }
	catch { throw error(502, 'รูปแบบข้อมูล API EasyDonate ยังไม่ตรงกับตัวตรวจยอด (ED_SCHEMA)'); }
	const payment = payments.find(p => matchesPaidDonation(p, order));
	if (!matchesPaidDonation(payment, order)) return { status: new Date(order.expires_at).getTime() < Date.now() ? 'expired' : 'pending' };
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		// Always take the user lock before the order lock to serialize renewals.
		await client.query('SELECT sub FROM users WHERE sub = $1 FOR UPDATE', [order.user_sub]);
		const current = await client.query('SELECT * FROM payment_orders WHERE id = $1 FOR UPDATE', [id]);
		if (current.rows[0].status === 'paid') {
			await client.query('COMMIT');
			return { status: 'paid', expiresAt: current.rows[0].pro_expires_at };
		}
		const paidAt = new Date(payment.createdAt ?? payment.time!);
		const result = await client.query(`UPDATE users SET plan = 'advanced', plan_expires_at =
			GREATEST(COALESCE(plan_expires_at, $2), $2) + INTERVAL '1 month'
			WHERE sub = $1 RETURNING plan_expires_at`, [order.user_sub, paidAt]);
		const expiry = result.rows[0].plan_expires_at;
		await client.query("UPDATE payment_orders SET status = 'paid', provider_reference = $2, paid_at = $3, pro_expires_at = $4 WHERE id = $1", [id, payment.referenceNo, paidAt, expiry]);
		await client.query('COMMIT');
		return { status: 'paid', expiresAt: expiry };
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally { client.release(); }
}
