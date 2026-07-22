import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { ensureUser } from '$lib/server/db';
import { isAdminEmail } from '$lib/server/admin';

export async function GET({ request }: { request: Request }) {
	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}

	const { plan, planExpiresAt } = await ensureUser(payload.sub, payload.email, payload.name);
	return json({ plan, planExpiresAt, isAdmin: isAdminEmail(payload.email) });
}
