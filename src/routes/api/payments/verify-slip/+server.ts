import { error, json } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { verifyPromptPaySlip } from '$lib/server/promptpay-payments';

export async function POST({ request }: { request: Request }) {
	let user;
	try { user = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID); }
	catch { throw error(401, 'กรุณาเข้าสู่ระบบ'); }
	const length = Number(request.headers.get('content-length'));
	if (length > 4_300_000) throw error(413, 'สลิปต้องมีขนาดไม่เกิน 4 MB');
	const reader = request.body?.getReader();
	if (!reader) throw error(400, 'ไม่พบสลิป');
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > 4_300_000) { await reader.cancel(); throw error(413, 'สลิปต้องมีขนาดไม่เกิน 4 MB'); }
		chunks.push(value);
	}
	let form: FormData;
	try { form = await new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type') ?? '' }, body: Buffer.concat(chunks) }).formData(); }
	catch { throw error(400, 'ไฟล์สลิปไม่ถูกต้อง'); }
	const id = form.get('id');
	const file = form.get('slip');
	if (typeof id !== 'string' || !/^FB-[A-F0-9]{24}$/.test(id)) throw error(400, 'คำสั่งซื้อไม่ถูกต้อง');
	if (!(file instanceof File) || !file.size || file.size > 4_194_304 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw error(400, 'ใช้ไฟล์สลิป JPG, PNG หรือ WebP ไม่เกิน 4 MB');
	return json(await verifyPromptPaySlip(id, user.sub, file), { headers: { 'Cache-Control': 'no-store' } });
}
