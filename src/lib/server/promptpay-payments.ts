import { randomBytes } from 'node:crypto';
import { easySlipAvailable } from './easyslip-status';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { pool } from './db';
import { checkRateLimit } from './rate-limit';
import { normalizePromptPayPhone, proPromptPayImage, PRO_AMOUNT_SATANG } from './promptpay-qr';

export function promptPayConfig() {
	let phone = '';
	try { phone = normalizePromptPayPhone(env.PROMPTPAY_PHONE ?? ''); } catch { /* disabled */ }
	const amount = env.PRO_AMOUNT_SATANG === undefined ? PRO_AMOUNT_SATANG : Number(env.PRO_AMOUNT_SATANG);
	return {
		available: Number.isSafeInteger(amount) && amount > 0 && amount <= 100000000 && !!phone && !!env.PROMPTPAY_RECEIVER_NAME && !!env.EASYSLIP_API_KEY
			&& /^\d{3}$/.test(env.EASYSLIP_RECEIVER_BANK_CODE ?? '')
			&& /^\d{6,20}$/.test(env.EASYSLIP_RECEIVER_ACCOUNT ?? ''),
		amount, currency: 'thb', interval: 'month', intervalCount: 1,
		provider: 'promptpay', testMode: false
	};
}

export async function createPromptPayOrder(userSub: string) {
	const config = promptPayConfig();
	if (!config.available) throw error(503, 'ยังไม่ได้ตั้งค่าพร้อมเพย์และบริการตรวจสลิป');
	if (!(await checkRateLimit(`promptpay:create:${userSub}`, 5)).allowed) throw error(429, 'กรุณารอก่อนสร้างรายการใหม่');
	if (!(await easySlipAvailable(true))) throw error(503, 'ปิดรับชำระเงินชั่วคราว เนื่องจากบริการตรวจสลิปไม่พร้อม กรุณาลองใหม่ภายหลัง');
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('SELECT sub FROM users WHERE sub = $1 FOR UPDATE', [userSub]);
		const pending = await client.query("SELECT * FROM payment_orders WHERE user_sub = $1 AND provider = 'promptpay' AND amount_satang = $2 AND status = 'pending' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1", [userSub, config.amount]);
		let order = pending.rows[0];
		if (!order) {
			order = (await client.query("INSERT INTO payment_orders (id, user_sub, provider, amount_satang, expires_at) VALUES ($1, $2, 'promptpay', $3, NOW() + INTERVAL '30 minutes') RETURNING *", [`FB-${randomBytes(12).toString('hex').toUpperCase()}`, userSub, config.amount])).rows[0];
		}
		const qrImage = await proPromptPayImage(env.PROMPTPAY_PHONE!, order.amount_satang);
		await client.query('COMMIT');
		return { id: order.id, amount: order.amount_satang, expiresAt: order.expires_at, qrImage, receiverName: env.PROMPTPAY_RECEIVER_NAME, provider: 'promptpay' };
	} catch (err) { await client.query('ROLLBACK'); throw err; }
	finally { client.release(); }
}

export interface VerifiedSlip {
	isDuplicate: boolean;
	matchedAccount: { bankNumber: string; bank: { code: string } } | null;
	isAmountMatched?: boolean;
	amountInSlip: number;
	rawSlip: { transRef: string; date: string; countryCode: string; amount: { amount: number; local?: { currency: string } } };
}

type ExpectedReceiver = { account: string; bank: string; phone?: string };

function receiverMatches(matched: VerifiedSlip['matchedAccount'] | undefined, expected: ExpectedReceiver): boolean {
	if (!matched || typeof matched.bankNumber !== 'string') return false;
	const number = matched.bankNumber.replace(/[\s-]/g, '');
	if (matched.bank?.code === 'PROMPTPAY') {
		return typeof expected.phone === 'string' && /^0[689]\d{8}$/.test(expected.phone) && number === expected.phone;
	}
	return matched.bank?.code === expected.bank && number === expected.account;
}

export function validProSlip(value: unknown, order: { amount_satang: number; created_at: string | Date; expires_at: string | Date }, expected: ExpectedReceiver, now = Date.now()): value is VerifiedSlip {
	if (!value || typeof value !== 'object') return false;
	const s = value as Partial<VerifiedSlip>;
	const time = Date.parse(s.rawSlip?.date ?? '');
	return s.isAmountMatched === true && receiverMatches(s.matchedAccount, expected)
		&& typeof s.amountInSlip === 'number' && Math.abs(s.amountInSlip * 100 - order.amount_satang) < 0.000001
		&& typeof s.rawSlip?.amount?.amount === 'number' && Math.abs(s.rawSlip.amount.amount * 100 - order.amount_satang) < 0.000001
		&& s.rawSlip.countryCode === 'TH' && (!s.rawSlip.amount.local || s.rawSlip.amount.local.currency === 'THB' || s.rawSlip.amount.local.currency === '')
		&& typeof s.rawSlip.transRef === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(s.rawSlip.transRef)
		&& Number.isFinite(time) && time >= new Date(order.created_at).getTime()
		&& time <= new Date(order.expires_at).getTime() && time <= now + 60_000;
}

export function slipMismatchMessage(value: unknown, order: { amount_satang: number; created_at: string | Date; expires_at: string | Date }, expected: ExpectedReceiver, now = Date.now()): string {
	const s = value as Partial<VerifiedSlip> | null;
	if (!s || typeof s !== 'object') return 'บริการตรวจสลิปส่งข้อมูลไม่ครบ กรุณาติดต่อผู้ดูแล';
	if (s.isAmountMatched !== true || typeof s.amountInSlip !== 'number' || Math.abs(s.amountInSlip * 100 - order.amount_satang) >= 0.000001 || typeof s.rawSlip?.amount?.amount !== 'number' || Math.abs(s.rawSlip.amount.amount * 100 - order.amount_satang) >= 0.000001) return `ยอดในสลิปไม่ตรงกับคำสั่งซื้อ ${(order.amount_satang / 100).toFixed(2)} บาท หากโอนแล้วอย่าโอนซ้ำ กรุณาติดต่อผู้ดูแล`;
	if (!s.matchedAccount) return 'EasySlip ไม่พบบัญชีผู้รับที่ลงทะเบียนไว้ ผู้ดูแลต้องตรวจบัญชีรับเงินและสาขาที่ผูกกับ API key หากโอนแล้วอย่าโอนซ้ำ';
	if (!receiverMatches(s.matchedAccount, expected)) return s.matchedAccount.bank?.code === 'PROMPTPAY'
		? 'เบอร์พร้อมเพย์ผู้รับไม่ตรงกับ PROMPTPAY_PHONE ที่ใช้สร้าง QR หากโอนแล้วอย่าโอนซ้ำ กรุณาติดต่อผู้ดูแล'
		: 'บัญชีหรือธนาคารผู้รับไม่ตรงกับการตั้งค่าระบบ ผู้ดูแลต้องตรวจ EASYSLIP_RECEIVER_BANK_CODE และ EASYSLIP_RECEIVER_ACCOUNT หากโอนแล้วอย่าโอนซ้ำ';
	const time = Date.parse(s.rawSlip?.date ?? '');
	if (!Number.isFinite(time)) return 'บริการตรวจสลิปส่งเวลาชำระไม่ถูกต้อง กรุณาติดต่อผู้ดูแล';
	if (time < new Date(order.created_at).getTime()) return 'สลิปนี้โอนก่อนสร้างคำสั่งซื้อปัจจุบัน กรุณาติดต่อผู้ดูแลเพื่อตรวจรายการเดิม อย่าโอนซ้ำ';
	if (time > new Date(order.expires_at).getTime()) return 'สลิปนี้โอนหลังคำสั่งซื้อหมดอายุ กรุณาติดต่อผู้ดูแล อย่าโอนซ้ำ';
	if (time > now + 60_000) return 'เวลาชำระอยู่หลังเวลาของเซิร์ฟเวอร์ ผู้ดูแลต้องตรวจนาฬิกาเซิร์ฟเวอร์ อย่าโอนซ้ำ';
	return 'ข้อมูลสกุลเงินหรือเลขอ้างอิงสลิปไม่ผ่านการตรวจสอบ กรุณาติดต่อผู้ดูแลหากโอนแล้ว';
}

export async function verifyPromptPaySlip(id: string, userSub: string, file: File) {
	if (!promptPayConfig().available) throw error(503, 'ระบบตรวจสลิปยังไม่พร้อม');
	const found = await pool.query("SELECT * FROM payment_orders WHERE id = $1 AND user_sub = $2 AND provider = 'promptpay'", [id, userSub]);
	const order = found.rows[0];
	if (!order) throw error(404, 'ไม่พบคำสั่งซื้อ');
	if (order.status === 'paid') return { status: 'paid', expiresAt: order.pro_expires_at };
	if (!(await checkRateLimit(`promptpay:verify:${userSub}`, 3)).allowed || !(await checkRateLimit('promptpay:verify:global', 30)).allowed) throw error(429, 'ตรวจสลิปถี่เกินไป กรุณารอสักครู่');
	const form = new FormData();
	form.append('image', file, 'slip');
	form.append('matchAccount', 'true');
	form.append('matchAmount', String(order.amount_satang / 100));
	form.append('remark', id);
	// Our transaction reference UNIQUE constraint is authoritative for duplicates.
	// Provider duplicate flags include previous verification attempts, not payments.
	form.append('checkDuplicate', 'true');
	let response: Response;
	try { response = await fetch('https://api.easyslip.com/v2/verify/bank', { method: 'POST', headers: { Authorization: `Bearer ${env.EASYSLIP_API_KEY}` }, body: form, signal: AbortSignal.timeout(25_000), redirect: 'error' }); }
	catch { throw error(502, 'ติดต่อบริการตรวจสลิปไม่ได้ กรุณาลองใหม่'); }
	let body;
	try { body = await response.json(); } catch { throw error(502, 'บริการตรวจสลิปตอบข้อมูลไม่ถูกต้อง'); }
	if (!response.ok || body.success !== true) {
		const code = body.error?.code;
		if (['QUOTA_EXCEEDED', 'INVALID_API_KEY', 'MISSING_API_KEY', 'IP_NOT_ALLOWED', 'BRANCH_INACTIVE'].includes(code)) throw error(503, 'บริการตรวจสลิปยังไม่พร้อม กรุณาติดต่อผู้ดูแล');
		if (response.status >= 500) throw error(502, 'บริการตรวจสลิปขัดข้อง กรุณาลองใหม่');
		throw error(400, 'ตรวจสลิปไม่สำเร็จ กรุณาใช้สลิปจากแอปธนาคารที่มี QR ชัดเจน');
	}
	const expected = { account: env.EASYSLIP_RECEIVER_ACCOUNT!, bank: env.EASYSLIP_RECEIVER_BANK_CODE!, phone: normalizePromptPayPhone(env.PROMPTPAY_PHONE!) };
	if (!validProSlip(body.data, order, expected)) {
		const matched = body.data?.matchedAccount;
		// Log only comparisons and field types: never the slip, account, name or API key.
		console.warn('[promptpay:validation]', JSON.stringify({
			accountMatchedByProvider: !!matched,
			receiverMatches: receiverMatches(matched, expected),
			promptPayReceiver: matched?.bank?.code === 'PROMPTPAY',
			bankMatches: matched?.bank?.code === expected.bank,
			accountMatches: typeof matched?.bankNumber === 'string' && matched.bankNumber.replace(/[\s-]/g, '') === expected.account,
			bankCodeType: typeof matched?.bank?.code,
			accountType: typeof matched?.bankNumber,
			amountMatches: body.data?.isAmountMatched === true,
			configuredBankFormat: /^\d{3}$/.test(expected.bank),
			configuredAccountFormat: /^\d{6,20}$/.test(expected.account)
		}));
		throw error(400, slipMismatchMessage(body.data, order, expected));
	}
	const slip = body.data;
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('SELECT sub FROM users WHERE sub = $1 FOR UPDATE', [userSub]);
		const locked = await client.query('SELECT * FROM payment_orders WHERE id = $1 FOR UPDATE', [id]);
		if (locked.rows[0].status === 'paid') { await client.query('COMMIT'); return { status: 'paid', expiresAt: locked.rows[0].pro_expires_at }; }
		const reference = `bank:${slip.rawSlip.transRef}`;
		if ((await client.query('SELECT id FROM payment_orders WHERE provider_reference = $1', [reference])).rows.length) throw error(409, 'สลิปนี้ใช้ชำระรายการอื่นไปแล้ว');
		const paidAt = new Date(slip.rawSlip.date);
		const result = await client.query("UPDATE users SET plan = 'advanced', plan_expires_at = GREATEST(COALESCE(plan_expires_at, $2), $2) + INTERVAL '1 month' WHERE sub = $1 RETURNING plan_expires_at", [userSub, paidAt]);
		const expiry = result.rows[0].plan_expires_at;
		await client.query("UPDATE payment_orders SET status = 'paid', provider_reference = $2, paid_at = $3, pro_expires_at = $4 WHERE id = $1", [id, reference, paidAt, expiry]);
		await client.query('COMMIT');
		return { status: 'paid', expiresAt: expiry };
	} catch (err) {
		await client.query('ROLLBACK');
		if (err && typeof err === 'object' && 'code' in err && err.code === '23505') throw error(409, 'สลิปนี้ถูกใช้ชำระแล้ว');
		throw err;
	} finally { client.release(); }
}
