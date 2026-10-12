import { describe, it, expect, vi } from 'vitest';
import type Groq from 'groq-sdk';
vi.mock('$env/dynamic/private', () => ({ env: { GROQ_API_KEY: 'key', GROQ_TEXT_MODELS: 'retired-model,custom-chat', GROQ_VISION_MODELS: '' } }));
import { selectModelCandidates, withAvailableModel } from './ai-models';

describe('automatic model selection', () => {
	it('drops retired models and prioritizes configured active models', () => {
		expect(selectModelCandidates('text', ['custom-chat', 'openai/gpt-oss-20b'])).toEqual(['custom-chat', 'openai/gpt-oss-20b']);
	});
	it('discovers a renamed compatible vision family and excludes speech models', () => {
		expect(selectModelCandidates('vision', ['qwen/qwen3.9-27b', 'whisper-large-v4'])).toEqual(['qwen/qwen3.9-27b']);
	});
	it('retries a removed model and refreshes the catalog for its replacement', async () => {
		const list = vi.fn().mockResolvedValueOnce({ data: [{ id: 'openai/gpt-oss-120b' }] }).mockResolvedValueOnce({ data: [{ id: 'openai/gpt-oss-130b' }] });
		const call = vi.fn().mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce('ok');
		expect(await withAvailableModel({ models: { list } } as unknown as Groq, 'text', call)).toBe('ok');
		expect(call.mock.calls.map(args => args[0])).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-130b']);
	});
	it('does not retry invalid requests as though they were model failures', async () => {
		const call = vi.fn().mockRejectedValue({ status: 400, message: 'invalid messages' });
		await expect(withAvailableModel({ models: { list: vi.fn() } } as unknown as Groq, 'text', call)).rejects.toMatchObject({ status: 400 });
		expect(call).toHaveBeenCalledTimes(1);
	});
});
