import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { buildLayoutDescription } from '$lib/utils/diagram-description';

const LAYOUT_PROMPT = `You are an expert at laying out ER diagrams. Given entities and their relationships, determine optimal {x, y} positions for each entity.

Rules:
1. Connected entities should be close together but NOT overlapping
2. Related entities should be positioned logically (parent above child, or left-to-right)
3. Minimize line crossings between relationships
4. Leave enough space between entities (minimum 200px gap)
5. For Chen notation: leave extra space (minimum 300px) because entities have attribute ovals around them
6. Start positions from (100, 100)
7. Spread entities across the canvas — don't stack them vertically in a single column
8. Use a mix of horizontal and vertical arrangements based on relationships
9. Consider the entity name length when spacing — longer names need wider boxes

Return ONLY valid JSON in this format:
{
  "positions": {
    "entity_id_1": { "x": 100, "y": 100 },
    "entity_id_2": { "x": 400, "y": 100 }
  }
}

IMPORTANT: Every entity ID from the input MUST appear in the output positions.`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => Array.isArray(body.entities) && body.entities.length > 0,
		buildMessages: (body) => {
			const { entities, relationships, notation } = body;
			const desc = buildLayoutDescription(entities, relationships || [], notation || 'crows-foot');
			return [
				{ role: 'system', content: LAYOUT_PROMPT },
				{ role: 'user', content: desc }
			];
		},
		temperature: 0.7
	});
};
