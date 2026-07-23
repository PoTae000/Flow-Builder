/**
 * Shared validation and rate-limiting utilities for sync endpoints.
 */

import { error } from '@sveltejs/kit';
import { authenticateRequest } from '$lib/server/google-verify';
import { checkRateLimit } from '$lib/server/rate-limit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';

// --- Constants ---

export const SYNC_RATE_LIMIT = 30; // req/min per authenticated user
export const VERSION_RATE_LIMIT = 90; // req/min — lightweight poll endpoint (5s poll = 12/min)
export const MAX_DIAGRAMS_PER_PUSH = 50;
export const MAX_IDS_PER_PULL = 50;
export const MAX_DIAGRAM_DATA_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_FUTURE_TIMESTAMP_MS = 5 * 60 * 1000; // 5 minutes
export const DIAGRAM_ID_REGEX = /^[a-zA-Z0-9-]{6,40}$/;
export const MAX_DIAGRAMS_PER_USER = 200;

// --- Validators ---

export function isValidDiagramId(id: unknown): boolean {
	return typeof id === 'string' && DIAGRAM_ID_REGEX.test(id);
}

export function isValidTimestamp(ts: unknown): boolean {
	if (typeof ts !== 'number' || !Number.isFinite(ts)) return false;
	return ts <= Date.now() + MAX_FUTURE_TIMESTAMP_MS;
}

export function estimateDataSize(data: unknown): number {
	const str = JSON.stringify(data);
	return new TextEncoder().encode(str).length;
}

// --- Auth + Rate Limit ---

export async function authenticateAndRateLimit(
	request: Request,
	opts?: { bucket?: string; limit?: number }
): Promise<{ sub: string; remaining: number }> {
	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}

	const sub = payload.sub;
	if (!sub) throw error(401, 'Invalid token: missing sub');

	// Separate rate-limit bucket per endpoint class so the fast version poll
	// doesn't eat into the push/pull budget.
	const bucket = opts?.bucket ?? 'sync';
	const limit = opts?.limit ?? SYNC_RATE_LIMIT;
	const { allowed, remaining } = await checkRateLimit(`${bucket}:${sub}`, limit);
	if (!allowed) {
		throw error(429, 'Rate limit exceeded. Try again in a minute.');
	}

	return { sub, remaining };
}

export function withRateLimitHeaders(response: Response, _remaining: number): Response {
	// No-op: don't expose rate limit internals in response headers
	return response;
}
