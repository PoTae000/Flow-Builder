import type { Handle } from '@sveltejs/kit';
import { initSchema } from '$lib/server/db';
import { cleanupExpiredRateLimits } from '$lib/server/rate-limit';
import { TRUSTED_ORIGINS as TRUSTED_ORIGINS_ENV } from '$env/static/private';

// Auto-create tables on startup (non-blocking — app works without DB)
let dbReady = false;
initSchema()
	.then(() => { dbReady = true; console.log('[db] Schema ready'); })
	.catch((err) => console.error('[db] Schema init failed (app continues without DB):', err));

// Cleanup expired rate limits every 10 minutes
setInterval(() => {
	if (dbReady) cleanupExpiredRateLimits();
}, 10 * 60 * 1000);

// Trusted origins: same-origin + known embedding hosts (from env TRUSTED_ORIGINS, comma-separated)
const TRUSTED_ORIGINS = new Set(
	TRUSTED_ORIGINS_ENV ? TRUSTED_ORIGINS_ENV.split(',').map(s => s.trim()).filter(Boolean) : []
);

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Skip CORS for Stripe webhooks (Stripe sends POST without Origin header)
	if (path === '/api/stripe/webhook') {
		return resolve(event);
	}

	// CORS: restrict API endpoints to same-origin + trusted origins.
	// Compare Origin with Host header (not event.url.origin) so reverse proxies
	// and tunnels (Cloudflare Tunnel, ngrok, etc.) work correctly.
	if (path.startsWith('/api/')) {
		const origin = event.request.headers.get('origin');
		// Allow GET requests without Origin (same-origin GET from fetch often lacks Origin)
		// Block other methods without Origin (prevents curl/script abuse)
		if (!origin && event.request.method !== 'GET') {
			return new Response('Forbidden', { status: 403 });
		}
		if (origin) {
			const originHost = new URL(origin).host;
			const requestHost = event.request.headers.get('host') || event.url.host;
			const sameOrigin = originHost === requestHost;
			if (!sameOrigin && !TRUSTED_ORIGINS.has(origin)) {
				return new Response('Forbidden', { status: 403 });
			}
		}

		// Handle CORS preflight
		if (event.request.method === 'OPTIONS' && origin) {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': origin,
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Max-Age': '86400'
				}
			});
		}
	}

	const response = await resolve(event);

	// Set CORS headers for trusted cross-origin requests
	const origin = event.request.headers.get('origin');
	if (origin && TRUSTED_ORIGINS.has(origin) && path.startsWith('/api/')) {
		response.headers.set('Access-Control-Allow-Origin', origin);
		response.headers.set('Access-Control-Allow-Credentials', 'true');
	}

	// Security headers
	// Allow Google Sign-In popup to communicate back via postMessage
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	// Allow embedding from HyperTech desktop
	// X-Frame-Options removed — using CSP frame-ancestors instead
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
		"script-src 'self' accounts.google.com static.cloudflareinsights.com 'unsafe-inline'",
		"style-src 'self' fonts.googleapis.com accounts.google.com 'unsafe-inline'",
		"font-src 'self' fonts.gstatic.com",
		"img-src 'self' data: blob: *.googleusercontent.com",
		"connect-src 'self' api.groq.com accounts.google.com www.googleapis.com fonts.googleapis.com cloudflareinsights.com wss://signaling.yjs.dev wss://*.suepskun.online wss://*.onrender.com https://*.onrender.com wss://*.herokuapp.com",
		"frame-src accounts.google.com",
		"worker-src 'self'",
		"object-src 'none'",
		`frame-ancestors 'self'${TRUSTED_ORIGINS.size ? ' ' + [...TRUSTED_ORIGINS].join(' ') : ''}`
	].join('; '));

	return response;
};
