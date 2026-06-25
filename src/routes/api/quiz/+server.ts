import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { sanitizeName } from '$lib/utils/sanitize';
import type { DiagramType } from '$lib/types/diagram';

const ER_QUIZ_PROMPT = `You are an expert database design instructor. Generate an ER diagram quiz question.

You MUST return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "title": "Short quiz title",
  "scenario": "2-4 sentence description of business requirements that the student must model as an ER diagram",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"],
  "idealSolution": {
    "entities": [
      { "name": "EntityName", "attributes": ["attr1 (PK)", "attr2", "attr3 (FK)"], "isWeak": false }
    ],
    "relationships": [
      { "name": "relationship_name", "from": "EntityA", "to": "EntityB", "cardinalityFrom": "1", "cardinalityTo": "N" }
    ]
  },
  "hints": ["hint 1", "hint 2", "hint 3"]
}

Difficulty levels:
- easy: 3-4 entities, simple 1:N relationships, straightforward business domain
- medium: 5-7 entities, mix of cardinalities (1:1, 1:N, M:N), some weak entities possible
- hard: 8-12 entities, complex cardinalities, weak entities, identifying relationships, advanced concepts

Rules:
- Every entity MUST have at least one PK attribute (mark with "(PK)")
- FK attributes should be marked with "(FK)"
- Scenarios should be realistic business domains
- Requirements should be specific enough to guide the student
- Hints should help without giving away the answer
- idealSolution must be a complete, correct solution
- Entity and attribute names should be in English (e.g. "Customer", "order_id")
- Valid cardinality values: "1", "N", "M", "0..1", "0..N", "1..N"

CRITICAL LANGUAGE RULES:
- "title", "scenario", "requirements", and "hints" MUST ALL be in Thai (ภาษาไทย)
- Use casual, friendly Thai — like a teacher explaining to students. NOT formal/textbook language.
- Use ภาษาพูด ที่เข้าใจง่าย เหมือนอาจารย์คุยกับนักศึกษา
- Example scenario: "ร้านขายหนังสือออนไลน์ต้องการระบบจัดการ..."
- Example requirement: "ลูกค้า 1 คนสั่งซื้อได้หลายออเดอร์"
- Example hint: "ลองคิดว่า ออเดอร์ 1 รายการมีสินค้าได้กี่ชิ้น?"`;

const FLOWCHART_QUIZ_PROMPT = `You are an expert in flowchart design. Generate a flowchart quiz question.

You MUST return ONLY valid JSON in this exact format:
{
  "title": "Short quiz title",
  "scenario": "2-3 sentence description of a process that the student must model as a flowchart",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"],
  "idealSolution": {
    "flowNodes": [
      { "name": "Start", "type": "start-end" },
      { "name": "Process Name", "type": "process" },
      { "name": "Decision?", "type": "decision" },
      { "name": "End", "type": "start-end" }
    ],
    "flowEdges": [
      { "fromNode": "Start", "toNode": "Process Name", "label": "" },
      { "fromNode": "Decision?", "toNode": "End", "label": "yes", "condition": "yes" }
    ]
  },
  "hints": ["hint 1", "hint 2", "hint 3"]
}

Difficulty levels:
- easy: 4-6 nodes, 0-1 decisions, simple linear process
- medium: 7-10 nodes, 2-3 decisions, some branching
- hard: 11-15 nodes, 3+ decisions, complex logic with loops

Rules:
- Must have exactly 1 Start node and at least 1 End node
- Decision nodes MUST have 2 outgoing edges (yes/no)
- Process names use action verbs
- Decision names are questions
- Valid node types: "start-end", "process", "decision", "input-output"

CRITICAL LANGUAGE RULES:
- "title", "scenario", "requirements", "hints" MUST be in Thai
- Use casual, friendly Thai`;

const DFD_QUIZ_PROMPT = `You are an expert in DFD (Data Flow Diagram) design. Generate a DFD quiz question.

You MUST return ONLY valid JSON in this exact format:
{
  "title": "Short quiz title",
  "scenario": "2-3 sentence description of a system that the student must model as a Context Diagram (DFD Level 0)",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"],
  "idealSolution": {
    "dfdNodes": [
      { "name": "Customer", "type": "external-entity" },
      { "name": "Process Order", "type": "process", "processNumber": "1.0" },
      { "name": "Orders DB", "type": "data-store", "storeNumber": "D1" }
    ],
    "dfdFlows": [
      { "fromNode": "Customer", "toNode": "Process Order", "label": "Order Request" },
      { "fromNode": "Process Order", "toNode": "Orders DB", "label": "Order Data" }
    ]
  },
  "hints": ["hint 1", "hint 2", "hint 3"]
}

Difficulty levels:
- easy: 2-3 external entities, 1-2 processes, 1-2 data stores
- medium: 3-4 external entities, 2-3 processes, 2-3 data stores
- hard: 4-5 external entities, 3-4 processes, 3-4 data stores

Rules:
- All processes MUST be numbered (1.0, 2.0, etc.)
- ALL flows MUST have descriptive labels
- External entities cannot connect directly
- Processes must have flows in AND out
- Valid node types: "process", "external-entity", "data-store"

CRITICAL LANGUAGE RULES:
- "title", "scenario", "requirements", "hints" MUST be in Thai
- Use casual, friendly Thai`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			const validDifficulties = ['easy', 'medium', 'hard'];
			return validDifficulties.includes(body.difficulty);
		},
		buildMessages: (body) => {
			const type: DiagramType = body.diagramType || 'er';
			const { difficulty, domain } = body;

			let systemPrompt: string;
			let quizType: string;

			if (type === 'flowchart') {
				systemPrompt = FLOWCHART_QUIZ_PROMPT;
				quizType = 'flowchart';
			} else if (type === 'context') {
				systemPrompt = DFD_QUIZ_PROMPT;
				quizType = 'DFD (Context Diagram)';
			} else {
				systemPrompt = ER_QUIZ_PROMPT;
				quizType = 'ER diagram';
			}

			let userMsg = `Generate a ${difficulty} difficulty ${quizType} quiz question.`;
			if (domain) {
				userMsg += ` The scenario should be related to: ${sanitizeName(String(domain), 200)}`;
			}
			return [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMsg }
			];
		},
		temperature: 0.5,
		maxTokens: 4096,
		jsonMode: true
	});
};
