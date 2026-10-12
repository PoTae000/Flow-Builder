import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { ensureUser } from '$lib/server/db';
import { createPromptPayOrder } from '$lib/server/promptpay-payments';

// Keep the route for existing clients; all new purchases use in-app PromptPay.
export async function POST({ request }: { request: Request }) {
    let payload;
    try { payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID); }
    catch { throw error(401, 'Unauthorized'); }
    await ensureUser(payload.sub, payload.email, payload.name);
    return json({ order: await createPromptPayOrder(payload.sub) });
}
