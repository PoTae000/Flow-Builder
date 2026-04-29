import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { buildDiagramDescription } from '$lib/utils/diagram-description';

const FIX_PROMPT = `You are an expert database architect. You will receive an ER diagram that has issues, along with a list of those issues. Your job is to fix ALL the issues AND proactively fix any other problems so the diagram scores a PERFECT 100/100.

You MUST return ONLY valid JSON (no markdown, no explanation) in this exact format:
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

GOAL: The output MUST be a PERFECT ER diagram that scores 100/100. Not 90, not 95 — exactly 100.

You will be graded on these exact criteria, so check ALL of them:
1. **Primary Keys**: Every entity MUST have at least one primary_key attribute. No exceptions.
2. **Naming Conventions**: Entity names = PascalCase singular nouns. Attribute names = consistent snake_case. ALL names must be consistent.
3. **Cardinality**: Every cardinality must be logically correct for the domain. e.g. Student-Course = M:N, not 1:1.
4. **Normalization**: Must be in 3NF. No multivalued attributes that should be separate entities. No partial/transitive dependencies.
5. **No Redundant Relationships**: No duplicate relationships between same entities.
6. **No Missing Relationships**: If entities logically relate, they MUST have a relationship.
7. **Weak Entities**: Properly identified with identifying relationships where needed.
8. **Foreign Keys**: FK attributes must reference existing entities. Every 1:N or M:N relationship should have corresponding FK attributes on the correct side.
9. **Attribute Types**: All attribute types must be correct (primary_key, foreign_key, derived, etc.).
10. **No Orphan Entities**: Every entity must have at least one relationship. No isolated entities.

Rules:
- Fix ALL listed issues AND proactively fix anything else that would lose points.
- Keep the original structure where correct — don't remove things unnecessarily.
- Add missing attributes (especially PKs and FKs) that are needed.
- Add missing relationships between entities that logically should be connected.
- After generating, mentally review your output against ALL 10 criteria above. If any fail, fix them before responding.`;

interface IssueData {
	severity: string;
	title: string;
	description: string;
	reason: string;
	fix: string;
}

function buildIssuesDescription(issues: IssueData[]): string {
	let desc = '## Issues to Fix\n\n';
	for (const issue of issues) {
		desc += `- [${issue.severity.toUpperCase()}] ${issue.title}: ${issue.description}\n`;
		desc += `  Fix: ${issue.fix}\n`;
	}
	return desc;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => Array.isArray(body.entities) && body.entities.length > 0,
		buildMessages: (body) => {
			const { entities, relationships, issues } = body;
			const diagramDescription = buildDiagramDescription(entities, relationships || [], { headerPrefix: 'Current ' });
			const issuesDescription = buildIssuesDescription(issues || []);
			const userContent = `Here is the current ER diagram and its issues. Fix ALL the issues and return the corrected diagram as JSON.\n\n${diagramDescription}\n\n${issuesDescription}`;

			return [
				{ role: 'system', content: FIX_PROMPT },
				{ role: 'user', content: userContent }
			];
		},
		temperature: 0.2
	});
};
