import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import type { DiagramType } from '$lib/types/diagram';

const GRADE_PROMPT = `You are an expert database design grading assistant. Grade a student's diagram solution against the ideal solution.

You MUST return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "score": 75,
  "grade": "B",
  "feedback": {
    "missingEntities": ["EntityName1"],
    "extraEntities": ["EntityName2"],
    "missingRelationships": ["EntityA - EntityB"],
    "wrongCardinality": [
      { "rel": "relationship_name", "expected": "1:N", "got": "1:1" }
    ],
    "missingPKs": ["EntityName"],
    "correctParts": ["Correctly identified Customer entity", "Good use of FK in Order"]
  },
  "overallComment": "Friendly, constructive feedback for the student"
}

For DFD/Context Diagrams, adapt the feedback fields:
- "missingEntities" → missing nodes (processes, external entities, data stores)
- "extraEntities" → extra/unnecessary nodes
- "missingRelationships" → missing data flows
- "wrongCardinality" → wrong flow directions or labels
- "missingPKs" → missing process numbers or store numbers

For Flowcharts, adapt similarly:
- "missingEntities" → missing nodes
- "missingRelationships" → missing edges/connections

Grading criteria:
- Entities/Nodes: +10 each correct, -5 each missing, -2 each extra/unnecessary
- Relationships/Flows/Edges: +15 each correct, -10 each missing
- Cardinality/Direction: +5 each correct, -5 each wrong
- Primary Keys/Numbers: +5 each correct, -8 each missing
- Base score starts at 0, cap at 100

Grade scale:
- A: 90-100
- B: 75-89
- C: 60-74
- D: 45-59
- F: 0-44

Rules:
- Be constructive and encouraging in overallComment
- List specific items in each feedback category
- Empty arrays for categories with no issues
- Compare names case-insensitively
- A student item matches if it's conceptually equivalent

CRITICAL LANGUAGE RULES:
- "overallComment" and "correctParts" MUST be in Thai (ภาษาไทย)
- Use casual, friendly Thai — like a teacher giving feedback to a student
- Use ภาษาพูด ที่เข้าใจง่าย เหมือนอาจารย์ comment งานนักศึกษา
- Example overallComment: "ทำได้ดีเลยนะ แค่ขาด entity สำหรับ payment ไป ลองเพิ่มดู"
- Example correctParts: "สร้าง Customer กับ Order ได้ถูกต้อง", "ใส่ PK ครบทุก entity ดีมาก"`;

export const POST: RequestHandler = async ({ request }) => {
	return aiRequest({
		request,
		validateBody: (body) => {
			if (!body.scenario || !body.idealSolution || !body.userSolution) return false;
			if (typeof body.scenario !== 'string' || body.scenario.length > 2000) return false;
			// Solutions must be plain objects — buildMessages reads nested arrays off them
			if (typeof body.idealSolution !== 'object' || Array.isArray(body.idealSolution)) return false;
			if (typeof body.userSolution !== 'object' || Array.isArray(body.userSolution)) return false;
			if (Array.isArray(body.requirements)) {
				if (body.requirements.length > 20) return false;
				if (body.requirements.some((r: unknown) => typeof r !== 'string' || (r as string).length > 500)) return false;
			}
			// Each solution must carry the array fields for its diagram type
			const type: DiagramType = body.diagramType || 'er';
			const requiredKeys = type === 'context'
				? ['dfdNodes', 'dfdFlows']
				: type === 'flowchart'
					? ['flowNodes', 'flowEdges']
					: ['entities', 'relationships'];
			for (const sol of [body.idealSolution, body.userSolution]) {
				const ok = requiredKeys.some((k) => Array.isArray(sol[k]))
					|| Array.isArray(sol.entities) || Array.isArray(sol.relationships);
				if (!ok) return false;
			}
			const idealStr = JSON.stringify(body.idealSolution);
			const userStr = JSON.stringify(body.userSolution);
			if (idealStr.length > 10000 || userStr.length > 10000) return false;
			return true;
		},
		buildMessages: (body) => {
			const { scenario, requirements, idealSolution, userSolution } = body;
			const diagramType: DiagramType = body.diagramType || 'er';
			const safeScenario = String(scenario).slice(0, 2000);
			const safeReqs = Array.isArray(requirements)
				? requirements.slice(0, 20).map((r: unknown) => String(r).slice(0, 500))
				: [];

			let typeLabel: string;
			let idealDesc: string;
			let studentDesc: string;

			if (diagramType === 'context') {
				typeLabel = 'DFD (Context Diagram)';
				idealDesc = `Nodes: ${JSON.stringify(idealSolution.dfdNodes || idealSolution.entities).slice(0, 10000)}\nFlows: ${JSON.stringify(idealSolution.dfdFlows || idealSolution.relationships).slice(0, 10000)}`;
				studentDesc = `Nodes: ${JSON.stringify(userSolution.dfdNodes || userSolution.entities).slice(0, 10000)}\nFlows: ${JSON.stringify(userSolution.dfdFlows || userSolution.relationships).slice(0, 10000)}`;
			} else if (diagramType === 'flowchart') {
				typeLabel = 'Flowchart';
				idealDesc = `Nodes: ${JSON.stringify(idealSolution.flowNodes || idealSolution.entities).slice(0, 10000)}\nEdges: ${JSON.stringify(idealSolution.flowEdges || idealSolution.relationships).slice(0, 10000)}`;
				studentDesc = `Nodes: ${JSON.stringify(userSolution.flowNodes || userSolution.entities).slice(0, 10000)}\nEdges: ${JSON.stringify(userSolution.flowEdges || userSolution.relationships).slice(0, 10000)}`;
			} else {
				typeLabel = 'ER diagram';
				idealDesc = `Entities: ${JSON.stringify(idealSolution.entities).slice(0, 10000)}\nRelationships: ${JSON.stringify(idealSolution.relationships).slice(0, 10000)}`;
				studentDesc = `Entities: ${JSON.stringify(userSolution.entities).slice(0, 10000)}\nRelationships: ${JSON.stringify(userSolution.relationships).slice(0, 10000)}`;
			}

			const userMsg = `Grade this student's ${typeLabel} solution.

SCENARIO:
${safeScenario}

REQUIREMENTS:
${safeReqs.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

IDEAL SOLUTION:
${idealDesc}

STUDENT'S SOLUTION:
${studentDesc}`;

			return [
				{ role: 'system', content: GRADE_PROMPT },
				{ role: 'user', content: userMsg }
			];
		},
		temperature: 0.2,
		maxTokens: 4096,
		jsonMode: true
	});
};
