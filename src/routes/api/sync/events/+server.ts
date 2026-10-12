import { error } from '@sveltejs/kit';
import { verifyGoogleToken } from '$lib/server/google-verify';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { subscribe } from '$lib/server/sync-events';
import type { RequestHandler } from './$types';


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

	
	const connId = url.searchParams.get('cid') || `${sub}:${Date.now()}`;
	
	const deviceLabel = (url.searchParams.get('device') || 'another device').slice(0, 60);

	const encoder = new TextEncoder();
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let unsubscribe: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			let closed = false;
			const enqueue = (text: string) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(text));
				} catch {
					// Controller already closed — ignore.
				}
			};
			const close = () => {
				if (closed) return;
				closed = true;
				if (heartbeat) clearInterval(heartbeat);
				if (unsubscribe) unsubscribe();
				try {
					controller.close();
				} catch {
					// Already closed — ignore.
				}
			};

			
			enqueue(': connected\n\n');

			
			
			unsubscribe = subscribe(sub, {
				connId,
				deviceLabel,
				connectedAt: Date.now(),
				send: (version: number) => {
					enqueue(`event: changed\ndata: ${version}\n\n`);
				},
				kick: (byDeviceLabel: string) => {
					
					enqueue(`event: kicked\ndata: ${JSON.stringify({ by: byDeviceLabel })}\n\n`);
					close();
				}
			});

			
			
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
			
			'X-Accel-Buffering': 'no'
		}
	});
};
