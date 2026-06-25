import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { buildDiagramDescription } from '$lib/utils/diagram-description';
import { buildUnifiedDiagramDescription } from '$lib/utils/diagram-description-multi';
import { validateEntityLimits, MAX_ISSUES } from '$lib/server/ai-limits';
import { sanitizeName } from '$lib/utils/sanitize';
import type { DiagramType } from '$lib/types/diagram';

const FLOWCHART_FIX_PROMPT = `You are an expert flowchart designer. You will receive a flowchart that has issues, along with a list of those issues. Your job is to fix ALL the issues AND proactively fix any other problems so the flowchart scores a PERFECT 100/100.

You MUST return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "flowNodes": [
    { "name": "Start", "type": "start-end" },
    { "name": "Process Data", "type": "process" },
    { "name": "Is Valid?", "type": "decision" },
    { "name": "End", "type": "start-end" }
  ],
  "flowEdges": [
    { "label": "", "fromNode": "Start", "toNode": "Process Data" },
    { "label": "", "fromNode": "Process Data", "toNode": "Is Valid?" },
    { "label": "yes", "fromNode": "Is Valid?", "toNode": "End", "condition": "yes" },
    { "label": "no", "fromNode": "Is Valid?", "toNode": "Process Data", "condition": "no" }
  ]
}

Node type must be one of: "start-end", "process", "decision", "input-output", "connector", "document", "database", "predefined-process", "manual-operation", "preparation", "delay", "display", "internal-storage"
Condition (optional) must be: "yes" or "no" (for decision nodes)

GOAL: The output MUST be a PERFECT flowchart that scores 100/100.

Checklist:
1. Exactly 1 Start node (start-end type)
2. At least 1 End node (start-end type)
3. All nodes reachable from Start
4. All paths lead to End
5. Decision nodes have exactly 2 outgoing edges (yes/no)
6. Process names use action verbs
7. Decision names are questions
8. No orphaned nodes
9. No infinite loops without exit
10. Clear, logical flow

Rules:
- Fix ALL listed issues AND proactively fix anything else
- Keep original structure where correct
- Add missing nodes (Start/End if missing)
- Connect orphaned nodes
- Label decision branches correctly`;

const DFD_FIX_PROMPT = `You are an expert DFD (Data Flow Diagram) designer. You will receive a DFD that has issues, along with a list of those issues. Your job is to fix ALL the issues AND proactively fix any other problems so the DFD scores a PERFECT 100/100.

You MUST return ONLY valid JSON (no markdown, no explanation) in this exact format:
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

Node type must be one of: "process", "external-entity", "data-store"
All processes MUST have processNumber (e.g., "1.0", "2.0")
All data-stores MUST have storeNumber (e.g., "D1", "D2", "D3")
ALL flows MUST have descriptive labels

GOAL: The output MUST be a PERFECT DFD that scores 100/100.

Checklist:
1. All processes have numbers (1.0, 2.0, etc.)
2. All processes have flows in AND out
3. External entities don't connect to each other directly
4. Data stores don't connect to external entities directly
5. ALL flows have descriptive labels
6. Processes use verb phrases
7. Data stores use nouns
8. External entities use nouns
9. No orphaned nodes
10. Logical, complete design

Rules:
- Fix ALL listed issues AND proactively fix anything else
- Keep original structure where correct
- Add missing flows for balance
- Number all processes correctly
- Label all flows descriptively`;

const ER_FIX_PROMPT = `You are an expert database architect. You will receive an ER diagram that has issues, along with a list of those issues. Your job is to fix ALL the issues AND proactively fix any other problems so the diagram scores a PERFECT 100/100.

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

function getFixPromptForType(diagramType: DiagramType): string {
	if (diagramType === 'flowchart') return FLOWCHART_FIX_PROMPT;
	if (diagramType === 'context') return DFD_FIX_PROMPT;
	return ER_FIX_PROMPT;
}

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

const ALLOWED_SEVERITIES = new Set(['error', 'warning', 'info']);

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			const type: DiagramType = body.diagramType || 'er';
			if (type === 'er') {
				if (!Array.isArray(body.entities) || body.entities.length === 0) return false;
			} else if (type === 'flowchart') {
				if (!Array.isArray(body.flowNodes) || body.flowNodes.length === 0) return false;
			} else if (type === 'context') {
				if (!Array.isArray(body.dfdNodes) || body.dfdNodes.length === 0) return false;
			}
			return validateEntityLimits(body);
		},
		buildMessages: (body) => {
			const type: DiagramType = body.diagramType || 'er';
			let issues: IssueData[] = Array.isArray(body.issues) ? body.issues : [];

			// H3: Sanitize issue fields and enforce limits
			issues = issues.slice(0, MAX_ISSUES).map((issue: IssueData) => ({
				severity: ALLOWED_SEVERITIES.has(issue.severity) ? issue.severity : 'info',
				title: sanitizeName(String(issue.title || ''), 200),
				description: sanitizeName(String(issue.description || ''), 500),
				reason: sanitizeName(String(issue.reason || ''), 500),
				fix: sanitizeName(String(issue.fix || ''), 500)
			}));

			// Build diagram description based on type
			let diagramDescription: string;
			if (type === 'er') {
				const { entities, relationships } = body;
				diagramDescription = buildDiagramDescription(entities, relationships || [], { headerPrefix: 'Current ' });
			} else {
				diagramDescription = buildUnifiedDiagramDescription(type, body);
			}

			const issuesDescription = buildIssuesDescription(issues);

			const typeLabel = type === 'er' ? 'ER diagram' :
				type === 'flowchart' ? 'flowchart' : 'DFD';

			const userContent = `Here is the current ${typeLabel} and its issues. Fix ALL the issues and return the corrected diagram as JSON.\n\n${diagramDescription}\n\n${issuesDescription}`;

			return [
				{ role: 'system', content: getFixPromptForType(type) },
				{ role: 'user', content: userContent }
			];
		},
		temperature: 0.2
	});
};
