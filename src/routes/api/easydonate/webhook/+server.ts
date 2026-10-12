import { json } from '@sveltejs/kit';
import { validWebhookSecret, reconcileEasyDonateOrder } from '$lib/server/easydonate';
import { checkRateLimit } from '$lib/server/rate-limit';

export async function POST({ request, url }: { request: Request; url: URL }) {
	if (!validWebhookSecret(url.searchParams.get('token'))) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!(await checkRateLimit('easydonate:webhook', 40)).allowed) return json({ error: 'Rate limited' }, { status: 429 });
	const raw = await request.text();
	if (raw.length > 8192) return json({ error: 'Payload too large' }, { status: 413 });
	let body;
	try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
	const id = typeof body?.donateMessage === 'string' ? body.donateMessage.trim() : '';
	if (!/^FB-[A-F0-9]{24}$/.test(id)) return json({ received: true, ignored: true });
	// The notification only triggers a lookup; it never grants access by itself.
	try { return json({ received: true, ...await reconcileEasyDonateOrder(id) }); }
	catch (err) {
		if (err && typeof err === 'object' && 'status' in err && err.status === 404) return json({ received: true, ignored: true });
		return json({ error: 'Verification pending' }, { status: 503 });
	}
}
