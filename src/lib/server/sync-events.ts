/**
 * In-memory pub/sub for realtime sync notifications (SSE).
 *
 * When one device pushes a change, the server notifies that user's OTHER
 * connected devices immediately so they pull right away instead of waiting for
 * the next poll cycle. This is a push signal only — the actual data still flows
 * through the existing /api/sync/push + /api/sync/pull + LWW machinery, which
 * is unchanged. If SSE drops, the client's slow backup poll still catches up.
 *
 * Single-process only (adapter-node `node build`). If this ever runs on
 * multiple instances, this bus would need Redis/Postgres LISTEN-NOTIFY —
 * but the app deploys as one process on the Pi, so in-memory is correct here.
 */

type Subscriber = {
	/** Unique per SSE connection, so a pusher can skip its own devices if desired. */
	connId: string;
	/** Called with the new cloud version so the client can decide to pull. */
	send: (version: number) => void;
};

// user sub -> set of live SSE connections for that user
const subscribers = new Map<string, Set<Subscriber>>();

export function subscribe(userSub: string, sub: Subscriber): () => void {
	let set = subscribers.get(userSub);
	if (!set) {
		set = new Set();
		subscribers.set(userSub, set);
	}
	set.add(sub);

	// Unsubscribe function
	return () => {
		const s = subscribers.get(userSub);
		if (!s) return;
		s.delete(sub);
		if (s.size === 0) subscribers.delete(userSub);
	};
}

/**
 * Notify all of a user's connected devices that the cloud changed.
 * `originConnId` (optional) is the connection that caused the change — skipped
 * so the device that just pushed doesn't get told to pull its own write.
 */
export function notifyUser(userSub: string, version: number, originConnId?: string): void {
	const set = subscribers.get(userSub);
	if (!set) return;
	for (const sub of set) {
		if (originConnId && sub.connId === originConnId) continue;
		try {
			sub.send(version);
		} catch {
			// A dead connection will be cleaned up by its own close handler.
		}
	}
}
