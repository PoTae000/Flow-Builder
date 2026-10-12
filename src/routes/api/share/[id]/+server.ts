import { json } from '@sveltejs/kit';
import { getShare } from '$lib/server/db';
import type { RequestHandler } from './$types';


export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	
	if (!id || id.length > 32 || !/^[A-Za-z0-9]+$/.test(id)) {
		return json({ error: 'not_found' }, { status: 404 });
	}

	let data: unknown;
	try {
		data = await getShare(id);
	} catch {
		return json({ error: 'server_error' }, { status: 500 });
	}

	if (data == null) {
		return json({ error: 'not_found', message: 'ไม่พบลิงก์นี้ หรือหมดอายุแล้ว' }, { status: 404 });
	}

	
	return json(data, {
		headers: { 'Cache-Control': 'public, max-age=3600, immutable' }
	});
};
