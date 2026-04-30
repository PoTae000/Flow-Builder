import { WebSocketServer, type WebSocket } from 'ws';
import type { Plugin } from 'vite';

/**
 * Vite plugin that embeds a y-webrtc signaling server into the dev server.
 * Handles WebSocket upgrade on /__signaling path.
 * Protocol: JSON messages with types: subscribe, unsubscribe, publish, ping/pong.
 */
export function signalingServer(): Plugin {
	const topics = new Map<string, Set<WebSocket>>();

	const send = (conn: WebSocket, message: object) => {
		if (conn.readyState !== 0 && conn.readyState !== 1) {
			conn.close();
			return;
		}
		try {
			conn.send(JSON.stringify(message));
		} catch {
			conn.close();
		}
	};

	const onConnection = (conn: WebSocket) => {
		const subscribedTopics = new Set<string>();
		let closed = false;
		let pongReceived = true;

		const pingInterval = setInterval(() => {
			if (!pongReceived) {
				conn.close();
				clearInterval(pingInterval);
			} else {
				pongReceived = false;
				try { conn.ping(); } catch { conn.close(); }
			}
		}, 30000);

		conn.on('pong', () => { pongReceived = true; });

		conn.on('close', () => {
			subscribedTopics.forEach((topicName) => {
				const subs = topics.get(topicName);
				if (subs) {
					subs.delete(conn);
					if (subs.size === 0) topics.delete(topicName);
				}
			});
			subscribedTopics.clear();
			closed = true;
			clearInterval(pingInterval);
		});

		conn.on('message', (raw: import('ws').RawData) => {
			let message: any;
			try {
				message = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
			} catch { return; }

			if (!message || !message.type || closed) return;

			switch (message.type) {
				case 'subscribe':
					(message.topics || []).forEach((topicName: string) => {
						if (typeof topicName === 'string') {
							if (!topics.has(topicName)) topics.set(topicName, new Set());
							topics.get(topicName)!.add(conn);
							subscribedTopics.add(topicName);
						}
					});
					break;
				case 'unsubscribe':
					(message.topics || []).forEach((topicName: string) => {
						const subs = topics.get(topicName);
						if (subs) subs.delete(conn);
					});
					break;
				case 'publish':
					if (message.topic) {
						const receivers = topics.get(message.topic);
						if (receivers) {
							message.clients = receivers.size;
							receivers.forEach((receiver) => send(receiver, message));
						}
					}
					break;
				case 'ping':
					send(conn, { type: 'pong' });
					break;
			}
		});
	};

	return {
		name: 'y-webrtc-signaling',
		configureServer(server) {
			const wss = new WebSocketServer({ noServer: true });
			wss.on('connection', onConnection);

			server.httpServer?.on('upgrade', (request, socket, head) => {
				if (request.url?.startsWith('/__signaling')) {
					wss.handleUpgrade(request, socket, head, (ws) => {
						wss.emit('connection', ws, request);
					});
				}
			});

			console.log('\x1b[36m  ➜  Signaling:\x1b[0m embedded at /__signaling');
		}
	};
}
