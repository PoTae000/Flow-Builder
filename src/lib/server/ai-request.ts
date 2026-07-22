/**
 * Shared pipeline for all AI endpoints.
 * Handles: optional auth, rate limiting, body parsing, Groq API, response validation.
 */

import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { GROQ_API_KEY } from '$env/static/private';
import { authenticateRequest } from '$lib/server/google-verify';
import { checkRateLimit } from '$lib/server/rate-limit';
import { getUserPlan } from '$lib/server/db';
import { isAdminEmail } from '$lib/server/admin';
import Groq from 'groq-sdk';

const ANON_RATE_LIMIT = 15; // req/min
const AUTH_RATE_LIMIT = 40; // req/min
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 MB

const groq = new Groq({ apiKey: GROQ_API_KEY });

export function getClientIp(request: Request): string {
	return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
		|| request.headers.get('x-real-ip')
		|| 'unknown';
}

/** Strip Qwen3 <think>...</think> reasoning blocks from output */
function stripThinkingTags(text: string): string {
	return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export interface AiRequestOptions {
	request: Request;
	buildMessages: (body: any) => Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
	validateBody?: (body: any) => boolean;
	/** Transform raw AI text before returning. Receives raw text, returns object to be JSON-serialized. */
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
		model = 'llama-3.3-70b-versatile',
		jsonMode = true
	} = opts;

	// 1. Body size check — read actual bytes (Content-Length header is spoofable)
	const rawText = await request.text();
	if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_SIZE) {
		throw error(413, 'Request body too large');
	}

	// 2. Auth — REQUIRED for AI
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

	// 3. Plan check — skip for admin
	const isAdmin = isAdminEmail(userEmail);
	if (!isAdmin) {
		const { plan } = await getUserPlan(userSub);
		if (plan !== 'advanced') {
			return json({ error: 'upgrade_required', message: 'กรุณาอัปเกรดเป็น Advanced เพื่อใช้งาน AI', plan: 'basic' }, { status: 403 });
		}
	}

	// 4. Rate limit
	const identifier = userSub;
	const limit = AUTH_RATE_LIMIT;
	const { allowed } = await checkRateLimit(identifier, limit);

	if (!allowed) {
		return json({ error: 'Rate limit exceeded' }, { status: 429 });
	}

	// 4. Parse body (from pre-read text — request.text() already consumed above)
	let body: any;
	try {
		body = JSON.parse(rawText);
	} catch {
		throw error(400, 'Invalid JSON');
	}
	if (validateBody && !validateBody(body)) {
		throw error(400, 'ข้อมูลไม่ถูกต้อง');
	}

	// 5. Build messages
	const messages = buildMessages(body);

	// 6. Groq API call
	try {
		const completion = await groq.chat.completions.create({
			model,
			messages: messages as Groq.Chat.Completions.ChatCompletionMessageParam[],
			temperature,
			max_tokens: maxTokens
		});

		let text = completion.choices[0]?.message?.content;

		if (!text) {
			console.error('Groq empty response');
			throw error(502, 'AI ไม่ตอบกลับ');
		}

		// Strip <think>...</think> blocks (Qwen thinking mode)
		text = stripThinkingTags(text);

		if (!text) {
			throw error(502, 'AI ไม่ตอบกลับ');
		}

		// 7. Parse/transform response
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

		// 8. Return response (no rate limit headers exposed)
		return json(parsed);
	} catch (err: unknown) {
		// Re-throw SvelteKit HttpErrors (from error() calls above)
		// SvelteKit errors have both 'status' and 'body', Groq SDK errors only have 'status'
		if (err && typeof err === 'object' && 'status' in err && 'body' in err) throw err;
		// Groq SDK errors or other failures → convert to proper SvelteKit error
		const msg = err instanceof Error ? err.message : 'Unknown error';
		console.error('AI request error:', msg);
		throw error(502, 'AI เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
	}
}
