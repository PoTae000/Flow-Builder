import { auth } from '$lib/stores/auth.svelte';
import { ui } from '$lib/stores/ui.svelte';

/**
 * Wrapper around fetch() for AI endpoints.
 * Handles auth token injection, plan gating, and upgrade modal trigger.
 */
export async function aiFetch(url: string, init?: RequestInit): Promise<Response> {
	// 1. Must be signed in
	if (!auth.isSignedIn) {
		return new Response(JSON.stringify({ error: 'login_required', message: 'กรุณาเข้าสู่ระบบเพื่อใช้งาน AI' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// 2. Client-side plan check (skip for admin)
	if (!auth.isAdmin && auth.plan !== 'advanced') {
		ui.showUpgradeModal = true;
		return new Response(JSON.stringify({ error: 'upgrade_required', message: 'กรุณาอัปเกรดเป็น Advanced เพื่อใช้งาน AI', plan: 'basic' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// 3. Get token
	const token = sessionStorage.getItem('er-diagram:id-token');
	if (!token) {
		return new Response(JSON.stringify({ error: 'login_required', message: 'กรุณาเข้าสู่ระบบเพื่อใช้งาน AI' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// 4. Inject Authorization header
	const headers = new Headers(init?.headers);
	headers.set('Authorization', `Bearer ${token}`);

	// 5. Make actual fetch
	const response = await fetch(url, { ...init, headers });

	// 6. Handle 403 upgrade_required from server
	if (response.status === 403) {
		try {
			const cloned = response.clone();
			const data = await cloned.json();
			if (data.error === 'upgrade_required') {
				ui.showUpgradeModal = true;
				auth.updatePlan('basic');
			}
		} catch {
			// ignore parse errors
		}
	}

	return response;
}
