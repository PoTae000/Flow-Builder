import { session } from '$lib/stores/session.svelte';
import { diagram } from '$lib/stores/diagram.svelte';
import { auth } from '$lib/stores/auth.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { toast } from '$lib/stores/toast.svelte';


export async function aiFetch(url: string, init?: RequestInit): Promise<Response> {
	const context = `${session.activeDiagramId}:${diagram.diagramType}:${diagram.dfdCurrentParentId ?? ''}`;
	
	if (!auth.isSignedIn) {
		ui.showUpgradeModal = true;
		return new Response(JSON.stringify({ error: 'login_required', message: 'กรุณาเข้าสู่ระบบเพื่อใช้งาน AI' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	
	if (!auth.isAdmin && auth.plan !== 'advanced') {
		ui.showUpgradeModal = true;
		return new Response(JSON.stringify({ error: 'upgrade_required', message: 'กรุณาอัปเกรดเป็น Advanced เพื่อใช้งาน AI', plan: 'basic' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	
	const token = sessionStorage.getItem('er-diagram:id-token');
	if (!token) {
		ui.loginRequested = true;
		return new Response(JSON.stringify({ error: 'login_required', message: 'กรุณาเข้าสู่ระบบเพื่อใช้งาน AI' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	
	const headers = new Headers(init?.headers);
	headers.set('Authorization', `Bearer ${token}`);

	
	// Every caller carries the diagram type, including name suggestions and imports.
	let body = init?.body;
	if (typeof body === 'string') {
		try { const payload = JSON.parse(body); body = JSON.stringify({ ...payload, diagramType: payload.diagramType ?? diagram.diagramType }); } catch { /* server validates malformed JSON */ }
	} else if (body instanceof FormData && !body.has('diagramType')) body.set('diagramType', diagram.diagramType);
	const response = await fetch(url, { ...init, body, headers });
	if (response.status === 401) ui.loginRequested = true;
	if (response.ok && context !== `${session.activeDiagramId}:${diagram.diagramType}:${diagram.dfdCurrentParentId ?? ''}`) {
		return new Response(JSON.stringify({ message: 'ไดอะแกรมเปลี่ยนระหว่างรอ AI กรุณาลองใหม่' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
	}

	
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

	
	
	
	if (response.status === 429) {
		try {
			const data = await response.clone().json();
			toast.warning(data.message || 'โควตา AI เต็มแล้ว ลองใหม่ภายหลัง');
		} catch {
			toast.warning('โควตา AI เต็มแล้ว ลองใหม่ภายหลัง');
		}
	}

	return response;
}
