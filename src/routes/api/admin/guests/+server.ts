

import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { isAdminEmail } from '$lib/server/admin';
import { getGuestList, removeGuest } from '$lib/server/db';

export async function GET({ request }: { request: Request }) {
	
	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}

	
	if (!isAdminEmail(payload.email)) {
		throw error(403, 'Forbidden');
	}

	
	const guests = await getGuestList();
	return json({ guests });
}


export async function DELETE({ request }: { request: Request }) {
	
	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}

	
	if (!isAdminEmail(payload.email)) {
		throw error(403, 'Forbidden');
	}

	
	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { guest_id } = body;
	if (!guest_id || typeof guest_id !== 'string') {
		throw error(400, 'Missing guest_id');
	}

	
	await removeGuest(guest_id);
	return json({ success: true, guest_id });
}
