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

vi.mock('$env/static/private', () => ({
	GROQ_API_KEY: 'test-key-123',
	DATABASE_URL: 'postgresql://test@localhost/test'
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

vi.mock('$lib/server/db', () => ({
	pool: { query: vi.fn() }
}));

// Mock groq-sdk — use vi.hoisted so mockCreate is available in the hoisted mock factory
const { mockCreate } = vi.hoisted(() => {
	const mockCreate = vi.fn();
	return { mockCreate };
});
vi.mock('groq-sdk', () => {
	return {
		default: class Groq {
			chat = {
				completions: {
					create: mockCreate
				}
			};
		}
	};
});

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
		mockCreate.mockReset();
	});

	it('rejects invalid body when validateBody returns false', async () => {
		const request = makeRequest({ bad: true });

		await expect(
			aiRequest({
				request,
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
			buildMessages: () => [{ role: 'user', content: 'test' }]
		});

		expect(response.status).toBe(429);
	});

	it('handles malformed AI JSON response gracefully', async () => {
		mockCreate.mockResolvedValue({
			choices: [{ message: { content: 'not valid json {{{' } }]
		});

		const request = makeRequest({ entities: [{ id: '1' }] });
		await expect(
			aiRequest({
				request,
				buildMessages: () => [{ role: 'user', content: 'test' }],
				jsonMode: true
			})
		).rejects.toMatchObject({ status: 502 });
	});

	it('returns valid response on success', async () => {
		mockCreate.mockResolvedValue({
			choices: [{ message: { content: '{"score": 85}' } }]
		});

		const request = makeRequest({ entities: [{ id: '1' }] });
		const response = await aiRequest({
			request,
			buildMessages: () => [{ role: 'user', content: 'analyze' }],
			jsonMode: true
		});

		expect(response.status).toBe(200);
		const data: any = await response.json();
		expect(data.score).toBe(85);
	});

	it('uses transformResponse when provided', async () => {
		mockCreate.mockResolvedValue({
			choices: [{ message: { content: 'some code here' } }]
		});

		const request = makeRequest({ language: 'sql-mysql' });
		const response = await aiRequest({
			request,
			buildMessages: () => [{ role: 'user', content: 'generate' }],
			jsonMode: false,
			transformResponse: (text) => ({ code: text, language: 'MySQL' })
		});

		const data: any = await response.json();
		expect(data.code).toBe('some code here');
		expect(data.language).toBe('MySQL');
	});

	it('wraps plain text response in { content } when jsonMode is false', async () => {
		mockCreate.mockResolvedValue({
			choices: [{ message: { content: 'Hello, สวัสดี!' } }]
		});

		const request = makeRequest({ messages: [{ role: 'user', content: 'hi' }] });
		const response = await aiRequest({
			request,
			buildMessages: () => [{ role: 'user', content: 'hi' }],
			jsonMode: false
		});

		const data: any = await response.json();
		expect(data.content).toBe('Hello, สวัสดี!');
	});
});
