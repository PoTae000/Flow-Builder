

type Subscriber = {
	
	connId: string;
	
	deviceLabel: string;
	
	connectedAt: number;
	
	send: (version: number) => void;
	
	kick: (byDeviceLabel: string) => void;
};


const subscribers = new Map<string, Set<Subscriber>>();


export function subscribe(userSub: string, sub: Subscriber): () => void {
	let set = subscribers.get(userSub);
	if (!set) {
		set = new Set();
		subscribers.set(userSub, set);
	}
	set.add(sub);

	return () => {
		const s = subscribers.get(userSub);
		if (!s) return;
		s.delete(sub);
		if (s.size === 0) subscribers.delete(userSub);
	};
}


export function kickOtherDevices(userSub: string, keepConnId: string, byDeviceLabel: string): void {
	const set = subscribers.get(userSub);
	if (!set) return;
	for (const existing of [...set]) {
		if (existing.connId === keepConnId) continue;
		try {
			existing.kick(byDeviceLabel);
		} catch {
			// Kicked stream is cleaned up by its own cancel handler.
		}
		set.delete(existing);
	}
}


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
