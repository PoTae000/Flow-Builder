import { error } from '@sveltejs/kit';
import { verifyGoogleToken } from '$lib/server/google-verify';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { subscribe } from '$lib/server/sync-events';
import type { RequestHandler } from './$types';

/**
 * Server-Sent Events stream for realtime cross-device sync.
 *
 * The browser's EventSource can't send an Authorization header, so the id
 * token is passed as a query param (?token=) over HTTPS to our own origin.
 * We verify it exactly like every other sync endpoint before opening the
 * stream. Each connected device holds one long-lived GET here; when any of
 * the user's devices pushes a change, the server sends a "changed" event and
 * the client triggers a full sync (same pull/LWW path as the poll).
 */
export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token) throw error(401, 'Missing token');

	let sub: string;
	try {
		const payload = await verifyGoogleToken(token, PUBLIC_GOOGLE_CLIENT_ID);
		sub = payload.sub;
	} catch {
		throw error(401, 'Unauthorized');
	}
	if (!sub) throw error(401, 'Invalid token');

	// A stable id for this specific connection (so a pusher can be skipped).
	const connId = url.searchParams.get('cid') || `${sub}:${Date.now()}`;

	const encoder = new TextEncoder();
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let unsubscribe: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const enqueue = (text: string) => {
				try {
					controller.enqueue(encoder.encode(text));
				} catch {
					// Controller already closed — ignore.
				}
			};

			// Initial comment so the connection is considered open by proxies.
			enqueue(': connected\n\n');

			// Notify handler: tell the client a new version exists.
			unsubscribe = subscribe(sub, {
				connId,
				send: (version: number) => {
					enqueue(`event: changed\ndata: ${version}\n\n`);
				}
			});

			// Heartbeat every 25s keeps the connection alive through Cloudflare
			// Tunnel / proxy idle timeouts (typically 30–100s).
			heartbeat = setInterval(() => {
				enqueue(`: ping\n\n`);
			}, 25_000);
		},
		cancel() {
			if (heartbeat) clearInterval(heartbeat);
			if (unsubscribe) unsubscribe();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			// Disable proxy buffering (nginx) so events flush immediately.
			'X-Accel-Buffering': 'no'
		}
	});
};
