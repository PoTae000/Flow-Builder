import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SvelteKit modules before importing
vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: ResponseInit) => {
		const body = JSON.stringify(data);
		const res = new Response(body, {
			...init,
			headers: { 'Content-Type': 'application/json', ...init?.headers }
		});
		return res;
	},
	error: (status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: { GROQ_API_KEY: 'test-key-123' }
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_GOOGLE_CLIENT_ID: 'test-client-id'
}));

vi.mock('$lib/server/google-verify', () => ({
	authenticateRequest: vi.fn(async () => {
		throw new Error('No auth');
	})
}));

vi.mock('$lib/server/rate-limit', () => ({
	checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 4 }))
}));

// Now import the module under test
import { aiRequest } from './ai-request';
import { checkRateLimit } from './rate-limit';

const mockCheckRateLimit = vi.mocked(checkRateLimit);

function makeRequest(body: unknown): Request {
	return new Request('http://localhost/api/test', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('aiRequest', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		// Re-apply rate limit mock
		mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4 });
	});

	it('rejects invalid body when validateBody returns false', async () => {
		const request = makeRequest({ bad: true });

		await expect(
			aiRequest({
				request,
				platform: undefined,
				validateBody: (body) => Array.isArray(body.entities),
				buildMessages: () => [{ role: 'user', content: 'test' }]
			})
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 429 when rate limited', async () => {
		mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

		const request = makeRequest({ entities: [] });
		const response = await aiRequest({
			request,
			platform: undefined,
			buildMessages: () => [{ role: 'user', content: 'test' }]
		});

		expect(response.status).toBe(429);
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
	});

	it('handles malformed AI JSON response gracefully', async () => {
		// Mock fetch to return malformed JSON
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					choices: [{ message: { content: 'not valid json {{{' } }]
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		try {
			const request = makeRequest({ entities: [{ id: '1' }] });
			await expect(
				aiRequest({
					request,
					platform: undefined,
					buildMessages: () => [{ role: 'user', content: 'test' }],
					jsonMode: true
				})
			).rejects.toMatchObject({ status: 502 });
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('returns valid response with rate limit header on success', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					choices: [{ message: { content: '{"score": 85}' } }]
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		try {
			const request = makeRequest({ entities: [{ id: '1' }] });
			const response = await aiRequest({
				request,
				platform: undefined,
				buildMessages: () => [{ role: 'user', content: 'analyze' }],
				jsonMode: true
			});

			expect(response.status).toBe(200);
			expect(response.headers.get('X-RateLimit-Remaining')).toBe('4');
			const data: any = await response.json();
			expect(data.score).toBe(85);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('uses transformResponse when provided', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					choices: [{ message: { content: 'some code here' } }]
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		try {
			const request = makeRequest({ language: 'sql-mysql' });
			const response = await aiRequest({
				request,
				platform: undefined,
				buildMessages: () => [{ role: 'user', content: 'generate' }],
				jsonMode: false,
				transformResponse: (text) => ({ code: text, language: 'MySQL' })
			});

			const data: any = await response.json();
			expect(data.code).toBe('some code here');
			expect(data.language).toBe('MySQL');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('wraps plain text response in { content } when jsonMode is false', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					choices: [{ message: { content: 'Hello, สวัสดี!' } }]
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		try {
			const request = makeRequest({ messages: [{ role: 'user', content: 'hi' }] });
			const response = await aiRequest({
				request,
				platform: undefined,
				buildMessages: () => [{ role: 'user', content: 'hi' }],
				jsonMode: false
			});

			const data: any = await response.json();
			expect(data.content).toBe('Hello, สวัสดี!');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
