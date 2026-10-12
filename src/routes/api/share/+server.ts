import { json } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { checkRateLimit } from '$lib/server/rate-limit';
import { createShare } from '$lib/server/db';
import type { RequestHandler } from './$types';



const MAX_BODY_BYTES = 1024 * 1024; 
const SHARE_TTL_MS = 365 * 24 * 60 * 60 * 1000; 

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; 
const ID_LENGTH = 10;


function makeId(): string {
	const bytes = new Uint8Array(ID_LENGTH);
	crypto.getRandomValues(bytes);
	let out = '';
	for (let i = 0; i < ID_LENGTH; i++) {
		out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
	}
	return out;
}

export const POST: RequestHandler = async ({ request }) => {
	
	let userSub: string | null = null;
	try {
		const payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
		userSub = payload.sub;
	} catch {
		return json({ error: 'login_required', message: 'กรุณาเข้าสู่ระบบเพื่อสร้างลิงก์แชร์' }, { status: 401 });
	}

	
	const { allowed } = await checkRateLimit(`share:${userSub}`, 30);
	if (!allowed) {
		return json({ error: 'rate_limited', message: 'สร้างลิงก์บ่อยเกินไป ลองใหม่อีกครั้งในอีกสักครู่' }, { status: 429 });
	}

	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) {
		return json({ error: 'too_large', message: 'Diagram ใหญ่เกินไปสำหรับการแชร์' }, { status: 413 });
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return json({ error: 'bad_request', message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
	}

	
	if (!data || typeof data !== 'object') {
		return json({ error: 'bad_request', message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
	}

	
	for (let attempt = 0; attempt < 5; attempt++) {
		const id = makeId();
		try {
			await createShare(id, data, userSub, Date.now() + SHARE_TTL_MS);
			return json({ id });
		} catch (e) {
			const msg = String((e as Error)?.message || '');
			if (msg.includes('duplicate') || msg.includes('unique')) continue; 
			return json({ error: 'server_error', message: 'บันทึกลิงก์ไม่สำเร็จ' }, { status: 500 });
		}
	}
	return json({ error: 'server_error', message: 'บันทึกลิงก์ไม่สำเร็จ' }, { status: 500 });
};
