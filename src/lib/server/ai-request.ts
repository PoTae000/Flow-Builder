/**
 * Shared pipeline for all AI endpoints.
 * Handles: optional auth, rate limiting, body parsing, Groq fetch with timeout, response validation.
 */

import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { checkRateLimit } from '$lib/server/rate-limit';

const ANON_RATE_LIMIT = 5; // req/min
const AUTH_RATE_LIMIT = 20; // req/min
const DEFAULT_TIMEOUT = 30_000; // 30s
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 MB

function getApiKey(platform: App.Platform | undefined): string | undefined {
	return platform?.env?.GROQ_API_KEY || env.GROQ_API_KEY;
}

export function getClientIp(request: Request): string {
	return request.headers.get('cf-connecting-ip') || 'unknown';
}

export interface AiRequestOptions {
	request: Request;
	platform: App.Platform | undefined;
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
		platform,
		buildMessages,
		validateBody,
		transformResponse,
		temperature = 0.3,
		maxTokens = 4096,
		model = 'llama-3.3-70b-versatile',
		jsonMode = true
	} = opts;

	// 1. Check API key
	const apiKey = getApiKey(platform);
	if (!apiKey) {
		throw error(503, 'ฟีเจอร์ AI ยังไม่พร้อมใช้งาน ต้องตั้งค่า GROQ_API_KEY ก่อน');
	}

	// 1.5 Body size check — read actual bytes (Content-Length header is spoofable)
	const rawText = await request.text();
	if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_SIZE) {
		throw error(413, 'Request body too large');
	}

	// 2. Optional auth
	let userSub: string | null = null;
	try {
		const payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
		userSub = payload.sub;
	} catch {
		// Anonymous — that's fine
	}

	// 3. Rate limit
	const kv = platform?.env?.DIAGRAMS_KV;
	const identifier = userSub || `ip:${getClientIp(request)}`;
	const limit = userSub ? AUTH_RATE_LIMIT : ANON_RATE_LIMIT;
	const { allowed } = await checkRateLimit(kv, identifier, limit);

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

	// 6. Groq fetch with timeout
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

	try {
		const groqBody: Record<string, unknown> = {
			model,
			messages,
			temperature,
			max_tokens: maxTokens
		};
		if (jsonMode) {
			groqBody.response_format = { type: 'json_object' };
		}

		const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify(groqBody),
			signal: controller.signal
		});

		if (!response.ok) {
			const errBody = await response.text();
			console.error('Groq API error:', response.status, errBody);
			throw error(
				response.status === 429 ? 429 : 502,
				response.status === 429
					? 'AI ยุ่งอยู่ ลองใหม่อีกครั้ง'
					: 'AI ทำงานผิดพลาด กรุณาลองใหม่'
			);
		}

		const result: any = await response.json();
		const text = result.choices?.[0]?.message?.content;

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
		if (err && typeof err === 'object' && 'status' in err) throw err;
		if (err instanceof DOMException && err.name === 'AbortError') {
			throw error(504, 'AI ใช้เวลานานเกินไป ลองใหม่อีกครั้ง');
		}
		console.error('AI request error:', err);
		throw error(500, 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
	} finally {
		clearTimeout(timeout);
	}
}
