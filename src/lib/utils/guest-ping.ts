

import { auth } from '$lib/stores/auth.svelte';

const PING_INTERVAL = 20_000;
let timer: ReturnType<typeof setInterval> | null = null;

async function ping(): Promise<void> {
	if (auth.isSignedIn) return;
	try {
		await fetch('/api/guest/ping', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}'
		});
	} catch {
		// best-effort — ignore network/DB errors
	}
}


export function startGuestPing(): () => void {
	stopGuestPing();
	void ping();
	timer = setInterval(() => void ping(), PING_INTERVAL);
	return stopGuestPing;
}

export function stopGuestPing(): void {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
}


export async function clearGuestSession(): Promise<void> {
	try {
		await fetch('/api/guest/ping', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: '{}'
		});
	} catch {
		// best-effort — ignore network/DB errors
	}
}
