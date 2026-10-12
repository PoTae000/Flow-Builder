import type { Handle } from '@sveltejs/kit';
import { initSchema, cleanupOldGuests, cleanupExpiredShares } from '$lib/server/db';
import { cleanupExpiredRateLimits } from '$lib/server/rate-limit';
import { TRUSTED_ORIGINS as TRUSTED_ORIGINS_ENV } from '$env/static/private';
import {
	isSensitivePath,
	alertSensitiveHit,
	isProbePath,
	recordProbe,
	recordApiAbuse,
	isBanned
} from '$lib/server/security-alert';


function clientIp(event: Parameters<Handle>[0]['event']): string {
	const xff = event.request.headers.get('x-forwarded-for');
	return xff ? xff.split(',')[0].trim() : event.getClientAddress();
}


let dbReady = false;
initSchema()
	.then(() => { dbReady = true; console.log('[db] Schema ready'); cleanupOldGuests(); })
	.catch((err) => console.error('[db] Schema init failed (app continues without DB):', err));


setInterval(() => {
	if (dbReady) cleanupExpiredRateLimits();
}, 10 * 60 * 1000);



setInterval(() => {
	if (dbReady) { cleanupOldGuests(); cleanupExpiredShares(); }
}, 24 * 60 * 60 * 1000);


const TRUSTED_ORIGINS = new Set(
	TRUSTED_ORIGINS_ENV ? TRUSTED_ORIGINS_ENV.split(',').map(s => s.trim()).filter(Boolean) : []
);

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	
	
	
	if (isBanned(clientIp(event))) {
		return new Response('Forbidden', { status: 403 });
	}

	
	// Provider callbacks do not carry a browser Origin. Their handlers verify
	// the Stripe signature or EasyDonate secret and independently check payment.
	if (path === '/api/stripe/webhook' || path === '/api/easydonate/webhook') {
		return resolve(event);
	}

	
	
	
	if (path.startsWith('/api/')) {
		const origin = event.request.headers.get('origin');
		
		
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
	// Prevent proxy-injected analytics scripts without changing cache privacy.
	if (response.headers.get('content-type')?.includes('text/html')) {
		const cache = response.headers.get('cache-control') || 'private, no-cache';
		if (!cache.split(',').some(value => value.trim() === 'no-transform')) {
			response.headers.set('cache-control', `${cache}, no-transform`);
		}
	}

	// Track API rate-limit (429) hits per IP and auto-ban repeat abusers — the
	// IP-level backstop for endpoints like /api/guest/ping and /api/health that
	// are otherwise unauthenticated. recordApiAbuse shares ban state with the
	// path-scan system, so an IP flooding any API endpoint gets 403'd globally.
	if (response.status === 429 && path.startsWith('/api/')) {
		recordApiAbuse(clientIp(event));
	}

	
	
	
	
	
	
	
	
	if (isProbePath(path)) {
		const ip = clientIp(event);
		const method = event.request.method;
		const userAgent = event.request.headers.get('user-agent') || '?';

		if (response.status !== 404 && isSensitivePath(path)) {
			alertSensitiveHit({ path, status: response.status, ip, method, userAgent });
		}
		recordProbe({ path, ip, method, userAgent, status: response.status });
	}

	
	const origin = event.request.headers.get('origin');
	if (origin && TRUSTED_ORIGINS.has(origin) && path.startsWith('/api/')) {
		response.headers.set('Access-Control-Allow-Origin', origin);
		response.headers.set('Access-Control-Allow-Credentials', 'true');
	}

	
	
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	
	
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

	
	
	
	
	
	response.headers.set('Content-Security-Policy', [
		"default-src 'self'",
		"script-src 'self' accounts.google.com static.cloudflareinsights.com 'unsafe-inline' 'wasm-unsafe-eval'",
		"style-src 'self' fonts.googleapis.com accounts.google.com 'unsafe-inline'",
		"font-src 'self' fonts.gstatic.com",
		"img-src 'self' data: blob: *.googleusercontent.com",
		
		
		
		
		"connect-src 'self' api.groq.com accounts.google.com www.googleapis.com fonts.googleapis.com fonts.gstatic.com cloudflareinsights.com wss://signaling.yjs.dev wss://*.suepskun.online wss://*.onrender.com https://*.onrender.com wss://*.herokuapp.com",
		"frame-src accounts.google.com",
		"worker-src 'self'",
		"object-src 'none'",
		
		
		path === '/embed'
			? 'frame-ancestors *'
			: `frame-ancestors 'self'${TRUSTED_ORIGINS.size ? ' ' + [...TRUSTED_ORIGINS].join(' ') : ''}`
	].join('; '));

	return response;
};
