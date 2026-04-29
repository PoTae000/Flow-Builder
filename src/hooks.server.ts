import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	// Allow Google Sign-In popup to communicate via postMessage
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	// Security headers (skip CSP — Svelte inline styles would break it)
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
};
