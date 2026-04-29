import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) =>
			typeof body.type === 'string' && ['entity', 'attribute', 'relationship'].includes(body.type),
		buildMessages: (body) => {
			const { context, currentName, type } = body;
			return [
				{
					role: 'system',
					content: `You are a database naming expert. Given the context of an ER diagram and a current name, suggest 5 better names following conventions: PascalCase for entities, snake_case for attributes, verb phrases for relationships. Return JSON: { "suggestions": string[] }`
				},
				{
					role: 'user',
					content: `Type: ${type}\nCurrent name: ${currentName || '(empty)'}\nExisting names in diagram: ${context || 'none'}\n\nSuggest 5 good names for this ${type}.`
				}
			];
		},
		temperature: 0.5,
		maxTokens: 256,
		jsonMode: true
	});
};
