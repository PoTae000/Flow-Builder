import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// CORS: restrict API endpoints to same-origin only.
	// Uses event.url.origin (derived from Host header validated by SvelteKit)
	// instead of raw Host header comparison which is spoofable.
	if (path.startsWith('/api/')) {
		const origin = event.request.headers.get('origin');
		// No Origin header → block (prevents curl/script abuse)
		if (!origin) {
			return new Response('Forbidden', { status: 403 });
		}
		// Cross-origin → block
		if (origin !== event.url.origin) {
			return new Response('Forbidden', { status: 403 });
		}
	}

	const response = await resolve(event);

	// Allow Google Sign-In popup to communicate via postMessage
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	// Security headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

	// Content Security Policy
	// NOTE (H4): 'unsafe-inline' in script-src is required because Google Identity Services (GIS)
	// library injects inline scripts at runtime. SvelteKit's nonce-based CSP does not work with
	// Google GIS since Google controls the inline script injection. This is an accepted risk —
	// mitigated by the restrictive default-src and other CSP directives.
	response.headers.set('Content-Security-Policy', [
		"default-src 'self'",
		"script-src 'self' accounts.google.com 'unsafe-inline'",
		"style-src 'self' fonts.googleapis.com 'unsafe-inline'",
		"font-src fonts.gstatic.com",
		"img-src 'self' data: blob: *.googleusercontent.com",
		"connect-src 'self' api.groq.com accounts.google.com www.googleapis.com wss://signaling.yjs.dev",
		"frame-src accounts.google.com",
		"object-src 'none'"
	].join('; '));

	return response;
};
