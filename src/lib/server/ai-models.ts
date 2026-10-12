import { env } from '$env/dynamic/private';
import type Groq from 'groq-sdk';

type Kind = 'text' | 'vision';
let cache: { key: string; until: number; ids: string[] } | undefined;

export function selectModelCandidates(kind: Kind, active?: string[], preferred?: string): string[] {
	const configured = (kind === 'text' ? env.GROQ_TEXT_MODELS : env.GROQ_VISION_MODELS)?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
	const defaults = kind === 'text' ? ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] : ['qwen/qwen3.8-27b'];
	// Models API does not advertise modalities. Discover compatible families only;
	// administrators can register another family through the environment variables.
	const discovered = (active ?? []).filter(id => kind === 'text'
		? /gpt-oss-|qwen\/qwen|llama.*(versatile|instant|instruct)/i.test(id) && !/guard|safeguard/i.test(id)
		: /qwen\/qwen\d+\.\d+-27b|llama.*vision/i.test(id))
		.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
	return [...new Set([...(preferred ? [preferred] : []), ...configured, ...defaults, ...discovered])]
		.filter(id => !active || active.includes(id));
}

export async function modelCandidates(groq: Groq, kind: Kind, preferred?: string, refresh = false): Promise<string[]> {
	let active: string[] | undefined;
	try {
		if (refresh || !cache || cache.key !== env.GROQ_API_KEY || cache.until <= Date.now()) {
			const models = await groq.models.list({ timeout: 8000 });
			cache = { key: env.GROQ_API_KEY ?? '', until: Date.now() + 300_000, ids: models.data.map(m => m.id) };
		}
		active = cache.ids;
	} catch { /* Keep configured candidates available during a catalog outage. */ }
	const candidates = selectModelCandidates(kind, active, preferred);
	if (!candidates.length) throw new Error(`ไม่มีโมเดล AI สำหรับ ${kind} ที่เปิดใช้งาน กรุณาตรวจการตั้งค่า Groq`);
	return candidates;
}

export function modelUnavailable(err: unknown): boolean {
	const e = err as { status?: number; message?: string; error?: { code?: string } };
	return e?.status === 404 || (e?.status === 400 && /model.*(decommission|deprecated|not.*exist|not.*found|not.*support)|model_not_found/i.test(`${e.message} ${e.error?.code}`));
}

export async function withAvailableModel<T>(groq: Groq, kind: Kind, call: (id: string) => Promise<T>, preferred?: string): Promise<T> {
	const attempted = new Set<string>();
	let last: unknown;
	for (const refresh of [false, true]) {
		for (const id of await modelCandidates(groq, kind, preferred, refresh)) {
			if (attempted.has(id)) continue;
			attempted.add(id);
			try { return await call(id); }
			catch (err) {
				last = err;
				if (!modelUnavailable(err) && (err as { status?: number })?.status !== 429) throw err;
			}
		}
		if (!modelUnavailable(last)) break;
	}
	throw last ?? new Error('ไม่มีโมเดล AI ที่รองรับ');
}
