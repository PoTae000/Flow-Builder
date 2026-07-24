import { auth } from '$lib/stores/auth.svelte';
import { session } from '$lib/stores/session.svelte';
import { sync } from '$lib/stores/sync.svelte';
import type { UserProfile } from '$lib/types/session';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';

const CLIENT_ID = PUBLIC_GOOGLE_CLIENT_ID || '';

function decodeJwt(token: string): Record<string, unknown> {
	const base64Url = token.split('.')[1];
	const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
	const json = decodeURIComponent(
		atob(base64)
			.split('')
			.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
			.join('')
	);
	return JSON.parse(json);
}

function handleCredentialResponse(response: google.accounts.id.CredentialResponse) {
	const payload = decodeJwt(response.credential);
	const profile: UserProfile = {
		sub: payload.sub as string,
		name: payload.name as string,
		email: payload.email as string,
		picture: payload.picture as string,
		plan: 'basic'
	};

	// Store ID token for cloud sync
	sessionStorage.setItem('er-diagram:id-token', response.credential);

	// Save current guest data before switching
	session.saveNow();

	auth.signIn(profile);
	session.initSession();

	// Fetch actual plan from server (non-blocking)
	fetchUserPlan(response.credential);
}

/** Fetch user plan from server and update auth store */
async function fetchUserPlan(token: string) {
	try {
		const res = await fetch('/api/user/plan', {
			headers: { 'Authorization': `Bearer ${token}` }
		});
		if (res.ok) {
			const data = await res.json();
			if (data.plan) {
				auth.updatePlan(data.plan, data.isAdmin ?? false, data.planExpiresAt ?? null);
			}
		}
	} catch {
		// Non-critical — plan stays as 'basic' until next refresh
	}
}

/**
 * Check if the stored ID token is expired or about to expire (within 5 min).
 * Returns true if token is valid (not expired).
 */
export function isTokenValid(): boolean {
	try {
		const token = sessionStorage.getItem('er-diagram:id-token');
		if (!token) return false;
		const payload = decodeJwt(token);
		const exp = payload.exp as number;
		if (!exp) return false;
		// Consider expired if within 5 minutes of expiry
		return exp > Date.now() / 1000 + 300;
	} catch {
		return false;
	}
}

/**
 * Silently refresh the Google ID token using One Tap prompt with auto_select.
 * Returns a promise that resolves when token is refreshed, or rejects on failure.
 */
export function refreshToken(): Promise<void> {
	if (!CLIENT_ID || !auth.googleReady) return Promise.reject(new Error('Google auth not ready'));

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error('Token refresh timeout'));
		}, 10000);

		// Re-initialize with a fresh callback that resolves the promise
		google.accounts.id.initialize({
			client_id: CLIENT_ID,
			callback: (response: google.accounts.id.CredentialResponse) => {
				clearTimeout(timeout);
				handleCredentialResponse(response);
				resolve();
			},
			auto_select: true,
			use_fedcm_for_prompt: true
		});
		google.accounts.id.prompt((notification: any) => {
			if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
				clearTimeout(timeout);
				reject(new Error('Token refresh failed - re-login required'));
			}
		});
	});
}

export function initGoogleAuth() {
	if (!CLIENT_ID) return;

	// Load GIS script dynamically
	if (document.getElementById('google-gis-script')) return;

	const script = document.createElement('script');
	script.id = 'google-gis-script';
	script.src = 'https://accounts.google.com/gsi/client';
	script.async = true;
	script.defer = true;
	script.onload = () => {
		google.accounts.id.initialize({
			client_id: CLIENT_ID,
			callback: handleCredentialResponse,
			auto_select: true,
			use_fedcm_for_prompt: true
		});
		auth.googleReady = true;
	};
	document.head.appendChild(script);
}

/**
 * Render the official Google "Sign in with Google" button into a container element.
 */
export function renderGoogleButton(container: HTMLElement) {
	if (!CLIENT_ID || !auth.googleReady) return;
	google.accounts.id.renderButton(container, {
		type: 'standard',
		theme: 'outline',
		size: 'medium',
		text: 'signin_with',
		shape: 'pill'
	});
}

/**
 * Trigger the Google One Tap prompt (fallback if renderButton not ready).
 */
export function triggerSignIn() {
	if (!CLIENT_ID || !auth.googleReady) return;
	google.accounts.id.prompt();
}

export function triggerSignOut() {
	session.saveNow();

	// Close the realtime stream + polling before the token is removed, so no
	// stale connection lingers with a revoked token.
	sync.stopEventStream();
	sync.stopPolling();

	// Remove ID token for cloud sync
	sessionStorage.removeItem('er-diagram:id-token');

	if (auth.user?.email) {
		google.accounts.id.revoke(auth.user.email, () => {});
	}

	auth.signOut();
	session.initSession();
}

export function isGoogleAuthAvailable(): boolean {
	return !!CLIENT_ID;
}
