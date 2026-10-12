

import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { isDiagramType, scopeInstruction, validateScopedResponse } from '$lib/utils/ai-scope';
import { authenticateRequest } from '$lib/server/google-verify';
import { checkRateLimit } from '$lib/server/rate-limit';
import { getUserPlan } from '$lib/server/db';
import { isAdminEmail } from '$lib/server/admin';
import Groq from 'groq-sdk';
import { withAvailableModel } from './ai-models';

const ANON_RATE_LIMIT = 15; 
const AUTH_RATE_LIMIT = 40; 
const MAX_BODY_SIZE = 1 * 1024 * 1024; 










function isRateLimit(err: unknown): boolean {
	return !!err && typeof err === 'object' && 'status' in err && (err as { status: unknown }).status === 429;
}


function retryHintFromError(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err ?? '');
	const m = msg.match(/try again in ([0-9hms.]+)/i);
	if (!m) return '';
	const raw = m[1];
	const h = raw.match(/(\d+)h/);
	const min = raw.match(/(\d+)m/);
	const parts: string[] = [];
	if (h) parts.push(`${h[1]} ชั่วโมง`);
	if (min) parts.push(`${min[1]} นาที`);
	return parts.length ? ` (ลองใหม่ในอีก ~${parts.join(' ')})` : '';
}

export function getClientIp(request: Request): string {
	
	
	const trusted = request.headers.get('cf-connecting-ip')
		|| request.headers.get('x-real-ip');
	if (trusted) return trusted.trim();

	
	
	
	const xff = request.headers.get('x-forwarded-for');
	if (xff) {
		const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
		if (parts.length) return parts[parts.length - 1];
	}

	return 'unknown';
}


function stripThinkingTags(text: string): string {
	let out = text.replace(/<think>[\s\S]*?<\/think>/g, '');
	const open = out.indexOf('<think>');
	if (open !== -1) out = out.slice(0, open);
	return out.trim();
}

export interface AiRequestOptions {
	request: Request;
	buildMessages: (body: any) => Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
	validateBody?: (body: any) => boolean;
	
	transformResponse?: (text: string, body: any) => unknown;
	temperature?: number;
	maxTokens?: number;
	model?: string;
	jsonMode?: boolean;
}

export async function aiRequest(opts: AiRequestOptions): Promise<Response> {
	const {
		request,
		buildMessages,
		validateBody,
		transformResponse,
		temperature = 0.3,
		maxTokens = 4096,
		model,
		jsonMode = true
	} = opts;

	
	const rawText = await request.text();
	if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_SIZE) {
		throw error(413, 'Request body too large');
	}

	
	let userSub: string | null = null;
	let userEmail: string | null = null;
	try {
		const payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
		userSub = payload.sub;
		userEmail = payload.email;
	} catch {
		// Anonymous — blocked
	}

	if (!userSub) {
		return json({ error: 'login_required', message: 'กรุณาเข้าสู่ระบบเพื่อใช้งาน AI' }, { status: 401 });
	}

	
	const isAdmin = isAdminEmail(userEmail);
	if (!isAdmin) {
		const { plan } = await getUserPlan(userSub);
		if (plan !== 'advanced') {
			return json({ error: 'upgrade_required', message: 'กรุณาอัปเกรดเป็น Advanced เพื่อใช้งาน AI', plan: 'basic' }, { status: 403 });
		}
	}

	
	const identifier = userSub;
	const limit = AUTH_RATE_LIMIT;
	const { allowed } = await checkRateLimit(identifier, limit);

	if (!allowed) {
		return json({ error: 'Rate limit exceeded' }, { status: 429 });
	}

	
	let body: any;
	try {
		body = JSON.parse(rawText);
	} catch {
		throw error(400, 'Invalid JSON');
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'ข้อมูลไม่ถูกต้อง');
	if (validateBody && !validateBody(body)) {
		throw error(400, 'ข้อมูลไม่ถูกต้อง');
	}

	
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'ข้อมูลไม่ถูกต้อง');
	if (body.diagramType !== undefined && !isDiagramType(body.diagramType)) throw error(400, 'ชนิดไดอะแกรมไม่ถูกต้อง');
	if (!env.GROQ_API_KEY) return json({ error: 'ai_unavailable', message: 'ยังไม่ได้ตั้งค่า GROQ_API_KEY บนเซิร์ฟเวอร์' }, { status: 503 });
	const groq = new Groq({ apiKey: env.GROQ_API_KEY, timeout: 60_000, maxRetries: 1 });
	const type = body.diagramType ?? 'er';
	const messages = buildMessages(body);
	messages.unshift({ role: 'system', content: scopeInstruction(type) + (jsonMode ? ' Return valid JSON only, with no markdown fences.' : '') });

	
	const callGroq = (useModel: string) =>
		groq.chat.completions.create({
			model: useModel,
			messages: messages as Groq.Chat.Completions.ChatCompletionMessageParam[],
			temperature,
			max_completion_tokens: maxTokens,
			...(useModel.startsWith('openai/gpt-oss-') ? { reasoning_format: 'hidden' as const, reasoning_effort: 'low' } : {}),
			
			
			...(jsonMode ? { response_format: { type: 'json_object' as const } } : {})
		});

	try {
		let completion;
		try {
			completion = await withAvailableModel(groq, 'text', callGroq, model);
		} catch (err) {
			if (isRateLimit(err)) return json({ error: 'ai_quota_exceeded', message: `โควตา AI เต็มแล้ว${retryHintFromError(err)}` }, { status: 429 });
			throw err;
		}

		let text = completion.choices[0]?.message?.content;

		if (!text) {
			console.error('Groq empty response');
			throw error(502, 'AI ไม่ตอบกลับ');
		}

		
		text = stripThinkingTags(text);

		if (!text) {
			throw error(502, 'AI ไม่ตอบกลับ');
		}

		
		let parsed: unknown;
		if (transformResponse) {
			parsed = transformResponse(text, body);
		} else if (jsonMode) {
			try {
				parsed = JSON.parse(text);
			} catch {
				throw error(502, 'AI ตอบกลับไม่ถูกรูปแบบ');
			}
		} else {
			parsed = { content: text };
		}

		
		if (!validateScopedResponse(parsed, type)) throw error(502, 'AI ส่งคำสั่งที่อยู่นอกขอบเขตไดอะแกรม กรุณาลองใหม่');
		return json(parsed);
	} catch (err: unknown) {
		
		
		if (err && typeof err === 'object' && 'status' in err && 'body' in err) throw err;
		
		if (isRateLimit(err)) {
			return json(
				{
					error: 'ai_quota_exceeded',
					message: `โควตา AI รายวันเต็มแล้ว${retryHintFromError(err)} — ระบบใช้ Groq รุ่นฟรีซึ่งจำกัดโทเคนต่อวัน`
				},
				{ status: 429 }
			);
		}
		
		const msg = err instanceof Error ? err.message : 'Unknown error';
		console.error('AI request error:', msg);
		throw error(502, 'AI เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
	}
}
