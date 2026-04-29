import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';

const DOMAIN_STARTER_PROMPT = `You are an expert database architect. Given a domain/business area, design a complete, well-normalized ER diagram schema.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "entities": [
    {
      "name": "EntityName",
      "attributes": [
        { "name": "id", "type": "primary_key" },
        { "name": "name", "type": "regular" },
        { "name": "other_id", "type": "foreign_key" }
      ],
      "isWeak": false
    }
  ],
  "relationships": [
    {
      "name": "relationship_name",
      "from": "EntityA",
      "to": "EntityB",
      "cardinalityFrom": "1",
      "cardinalityTo": "N",
      "isIdentifying": false
    }
  ]
}

Attribute type must be one of: "primary_key", "foreign_key", "regular", "partial_key", "derived", "multivalued", "composite"
Cardinality must be one of: "1", "N", "M", "0..1", "0..N", "1..1", "1..N"

Rules:
- Create 5-15 entities depending on the domain complexity
- Design in Third Normal Form (3NF) — no transitive dependencies
- Every entity MUST have at least one primary_key attribute (usually "id")
- Include junction/associative tables for many-to-many relationships
- Include weak entities where appropriate (e.g. OrderItem depends on Order)
- Use proper naming conventions (PascalCase for entities, snake_case for attributes)
- Add realistic attributes (not just id and name — include dates, status, amounts, etc.)
- Foreign key attributes should end with _id
- Detect cardinality correctly based on the domain context
- Cover the core domain thoroughly — include all essential entities`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => typeof body.domain === 'string' && body.domain.length > 0,
		buildMessages: (body) => {
			const { domain } = body;
			const userContent = `Design a complete ER diagram for this domain: "${domain}"

Create a comprehensive database schema covering all essential entities, attributes, and relationships for this domain. Include junction tables for M:N relationships and weak entities where appropriate. Return ONLY JSON.`;

			return [
				{ role: 'system', content: DOMAIN_STARTER_PROMPT },
				{ role: 'user', content: userContent }
			];
		},
		temperature: 0.2
	});
};
