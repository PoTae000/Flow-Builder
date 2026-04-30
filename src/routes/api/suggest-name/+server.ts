import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { sanitizeName } from '$lib/utils/sanitize';

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) =>
			typeof body.type === 'string' && ['entity', 'attribute', 'relationship'].includes(body.type),
		buildMessages: (body) => {
			const { context, currentName, type } = body;
			const safeName = sanitizeName(String(currentName || ''), 200);
			const safeContext = typeof context === 'string' ? context.slice(0, 1000) : 'none';
			return [
				{
					role: 'system',
					content: `You are a database naming expert. Given the context of an ER diagram and a current name, suggest 5 better names following conventions: PascalCase for entities, snake_case for attributes, verb phrases for relationships. Return JSON: { "suggestions": string[] }`
				},
				{
					role: 'user',
					content: `Type: ${type}\nCurrent name: ${safeName || '(empty)'}\nExisting names in diagram: ${safeContext}\n\nSuggest 5 good names for this ${type}.`
				}
			];
		},
		temperature: 0.5,
		maxTokens: 256,
		jsonMode: true
	});
};
