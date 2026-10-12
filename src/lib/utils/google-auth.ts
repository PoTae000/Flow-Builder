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


function applyCredential(credential: string, storeToken = true) {
	const payload = decodeJwt(credential);
	const profile: UserProfile = {
		sub: payload.sub as string,
		name: payload.name as string,
		email: payload.email as string,
		picture: payload.picture as string,
		plan: 'basic'
	};

	
	if (storeToken) sessionStorage.setItem('er-diagram:id-token', credential);

	
	session.saveNow();

	auth.signIn(profile);
	session.initSession();

	
	fetchUserPlan(credential);
}

function handleCredentialResponse(response: google.accounts.id.CredentialResponse) {
	applyCredential(response.credential);
}


export function restoreSessionFromStoredToken(): boolean {
	try {
		const token = sessionStorage.getItem('er-diagram:id-token');
		if (!token) return false;
		if (!isTokenValid()) {
			sessionStorage.removeItem('er-diagram:id-token');
			return false;
		}
		applyCredential(token, false); 
		return true;
	} catch {
		return false;
	}
}


export function ensureValidSession(): boolean {
	if (isTokenValid()) return true;

	
	triggerSignOut();
	return false;
}


async function fetchUserPlan(token: string) {
	try {
		const res = await fetch('/api/user/plan', {
			headers: { 'Authorization': `Bearer ${token}` }
		});
		if (res.ok) {
			await fetch('/api/user/pro-session', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
			const data = await res.json();
			if (data.plan) {
				auth.updatePlan(data.plan, data.isAdmin ?? false, data.planExpiresAt ?? null);
			}
		}
	} catch {
		// Non-critical — plan stays as 'basic' until next refresh
	}
}


export function isTokenValid(): boolean {
	try {
		const token = sessionStorage.getItem('er-diagram:id-token');
		if (!token) return false;
		const payload = decodeJwt(token);
		const exp = payload.exp as number;
		if (!exp) return false;
		
		return exp > Date.now() / 1000 + 300;
	} catch {
		return false;
	}
}


export function refreshToken(): Promise<void> {
	if (!CLIENT_ID || !auth.googleReady) return Promise.reject(new Error('Google auth not ready'));

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error('Token refresh timeout'));
		}, 10000);

		
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


function isMobile(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);
}

export function initGoogleAuth() {
	if (!CLIENT_ID) return;

	
	if (document.getElementById('google-gis-script')) return;

	const script = document.createElement('script');
	script.id = 'google-gis-script';
	script.src = 'https://accounts.google.com/gsi/client';
	script.async = true;
	script.defer = true;
	script.onload = () => {
		if (isMobile()) {
			
			
			
			
			
			
			const redirectConfig: Record<string, unknown> = {
				client_id: CLIENT_ID,
				ux_mode: 'redirect',
				login_uri: `${window.location.origin}/login/callback`,
				auto_select: false,
				use_fedcm_for_prompt: false
			};
			google.accounts.id.initialize(
				redirectConfig as Parameters<typeof google.accounts.id.initialize>[0]
			);
		} else {
			google.accounts.id.initialize({
				client_id: CLIENT_ID,
				callback: handleCredentialResponse,
				auto_select: true,
				use_fedcm_for_prompt: true
			});
		}
		auth.googleReady = true;
	};
	document.head.appendChild(script);
}


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


export function triggerSignIn() {
	if (!CLIENT_ID || !auth.googleReady) return;
	google.accounts.id.prompt();
}

export function triggerSignOut() {
	session.saveNow();

	
	
	sync.stopEventStream();
	sync.stopPolling();

	
	const logoutToken = sessionStorage.getItem('er-diagram:id-token');
	if (logoutToken) void fetch('/api/user/presence', { method: 'DELETE', headers: { Authorization: `Bearer ${logoutToken}` }, keepalive: true }).catch(() => {});
	sessionStorage.removeItem('er-diagram:id-token');

	if (auth.user?.email && auth.googleReady) {
		google.accounts.id.revoke(auth.user.email, () => {});
	}

	auth.signOut();
	void fetch('/api/user/pro-session', { method: 'DELETE', keepalive: true }).catch(() => {});
	session.initSession();
}

export function isGoogleAuthAvailable(): boolean {
	return !!CLIENT_ID;
}
