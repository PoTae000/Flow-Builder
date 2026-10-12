import { redirect } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { verifyGoogleToken } from '$lib/server/google-verify';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, setHeaders }) => {
	setHeaders({ 'Cache-Control': 'private, no-store' });
	try {
		await verifyGoogleToken(cookies.get('pro-access') ?? '', PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		cookies.delete('pro-access', { path: '/pro' });
		throw redirect(303, '/');
	}
	return {};
};
