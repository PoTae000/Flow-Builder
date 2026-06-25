import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { sanitizeName } from '$lib/utils/sanitize';
import type { DiagramType } from '$lib/types/diagram';

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

const FLOWCHART_STARTER_PROMPT = `You are an expert in flowchart design. Given a process description, create a complete flowchart.

Return ONLY valid JSON in this exact format:
{
  "flowNodes": [
    { "name": "Start", "type": "start-end" },
    { "name": "Process Data", "type": "process" },
    { "name": "Is Valid?", "type": "decision" },
    { "name": "End", "type": "start-end" }
  ],
  "flowEdges": [
    { "label": "", "fromNode": "Start", "toNode": "Process Data" },
    { "label": "yes", "fromNode": "Is Valid?", "toNode": "End", "condition": "yes" }
  ]
}

Node types: "start-end", "process", "decision", "input-output", "connector", "document", "database"
Condition (optional): "yes" or "no"

Rules:
- Start with exactly 1 Start node
- End with at least 1 End node
- Process names use action verbs
- Decision names are questions
- All nodes must be connected
- Decision nodes have 2 outgoing edges (yes/no)`;

const DFD_STARTER_PROMPT = `You are an expert in DFD (Data Flow Diagram) design. Given a system description, create a Context Diagram (Level 0 DFD).

Return ONLY valid JSON in this exact format:
{
  "dfdNodes": [
    { "name": "Customer", "type": "external-entity" },
    { "name": "Process Order", "type": "process", "processNumber": "1.0" },
    { "name": "Orders DB", "type": "data-store", "storeNumber": "D1" }
  ],
  "dfdFlows": [
    { "label": "Order Request", "fromNode": "Customer", "toNode": "Process Order" },
    { "label": "Order Data", "fromNode": "Process Order", "toNode": "Orders DB" }
  ]
}

Node types: "process", "external-entity", "data-store"

Rules:
- Number all processes (1.0, 2.0, etc.)
- All data-stores MUST have storeNumber (D1, D2, D3, etc.)
- All flows MUST have descriptive labels
- External entities cannot connect directly
- Processes must have flows in AND out
- Show all major external entities and data stores`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => typeof body.domain === 'string' && body.domain.length > 0 && body.domain.length <= 500,
		buildMessages: (body) => {
			const type: DiagramType = body.diagramType || 'er';
			const domain = sanitizeName(String(body.domain), 500);

			let systemPrompt: string;
			let userContent: string;

			if (type === 'flowchart') {
				systemPrompt = FLOWCHART_STARTER_PROMPT;
				userContent = `Design a flowchart for this process: "${domain}"\n\nCreate a complete flowchart covering all steps, decisions, and paths. Return ONLY JSON.`;
			} else if (type === 'context') {
				systemPrompt = DFD_STARTER_PROMPT;
				userContent = `Design a Context Diagram (DFD Level 0) for this system: "${domain}"\n\nCreate a complete DFD showing processes, external entities, data stores, and flows. Return ONLY JSON.`;
			} else {
				systemPrompt = DOMAIN_STARTER_PROMPT;
				userContent = `Design a complete ER diagram for this domain: "${domain}"\n\nCreate a comprehensive database schema covering all essential entities, attributes, and relationships for this domain. Include junction tables for M:N relationships and weak entities where appropriate. Return ONLY JSON.`;
			}

			return [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userContent }
			];
		},
		temperature: 0.2
	});
};
