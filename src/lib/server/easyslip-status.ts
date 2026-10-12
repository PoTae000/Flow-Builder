import { env } from '$env/dynamic/private';

export function easySlipReady(body: unknown, now = Date.now()): boolean {
	const b = body as { success?: boolean; data?: { branch?: { isActive?: boolean }; application?: { quota?: { max?: number | null; remaining?: number | null }; autoRenew?: { expiresAt?: string } } } } | null;
	const app = b?.data?.application;
	const expiry = Date.parse(app?.autoRenew?.expiresAt ?? '');
	const quota = app?.quota;
	return b?.success === true && b.data?.branch?.isActive === true && Number.isFinite(expiry) && expiry > now
		&& !!quota && (quota.max === null && quota.remaining === null || typeof quota.max === 'number' && Number.isFinite(quota.max) && quota.max > 0 && typeof quota.remaining === 'number' && Number.isFinite(quota.remaining) && quota.remaining > 0);
}

let cached: { key: string; expires: number; ready: boolean } | undefined;
let pending: { key: string; request: Promise<boolean> } | undefined;
export async function easySlipAvailable(fresh = false): Promise<boolean> {
	const key = env.EASYSLIP_API_KEY;
	if (!key) return false;
	if (!fresh && cached?.key === key && cached.expires > Date.now()) return cached.ready;
	if (pending?.key === key) return pending.request;
	const request = (async () => {
		let ready = false;
		try {
			const response = await fetch('https://api.easyslip.com/v2/info', { headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(8000) });
			if (response.ok) ready = easySlipReady(await response.json());
		} catch { /* Fail closed without logging private provider data. */ }
		cached = { key, expires: Date.now() + 15_000, ready };
		return ready;
	})();
	pending = { key, request };
	try { return await request; } finally { if (pending?.request === request) pending = undefined; }
}
