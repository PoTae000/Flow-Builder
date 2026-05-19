import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { buildLayoutDescription } from '$lib/utils/diagram-description';
import { validateEntityLimits } from '$lib/server/ai-limits';

const LAYOUT_PROMPT = `You are an expert at laying out ER diagrams for maximum readability.

Given entities with their pixel sizes and relationships, determine optimal {x, y} positions for each entity.

Critical rules:
1. NO OVERLAPPING: Entities must not overlap each other. Use provided pixel widths + heights to ensure separation.
2. NO LINE CROSSING: Minimize relationship line crossings. Connected entities should be near each other.
3. ENTITY-LINE SEPARATION: No entity should sit on top of a relationship line between other entities.
4. HIERARCHY: Hub entities (most connections, marked [HUB]) should be central. Leaf entities on periphery.
5. GROUPING: Tightly-connected clusters should be visually grouped together.
6. SPACING: Minimum 180px gap between entity edges. For Chen notation (with attribute ovals): minimum 250px gap.
7. READABILITY: Prefer horizontal/vertical alignment over diagonal scatter.
8. SPREAD: Use 2D canvas space — don't stack everything in one column or one row.
9. Use entity pixel widths and heights from input for accurate spacing calculations.
10. Start positions from (60, 60) — top-left corner of the canvas.

Return ONLY valid JSON in this format:
{
  "positions": {
    "entity_id_1": { "x": 60, "y": 60 },
    "entity_id_2": { "x": 400, "y": 60 }
  }
}

IMPORTANT: Every entity ID from the input MUST appear in the output positions.`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			if (!Array.isArray(body.entities) || body.entities.length === 0) return false;
			return validateEntityLimits(body);
		},
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
