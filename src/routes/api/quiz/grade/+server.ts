import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';

const GRADE_PROMPT = `You are an expert database design grading assistant. Grade a student's ER diagram solution against the ideal solution.

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

Grading criteria:
- Entities: +10 each correct, -5 each missing, -2 each extra/unnecessary
- Relationships: +15 each correct, -10 each missing
- Cardinality: +5 each correct, -5 each wrong
- Primary Keys: +5 each correct, -8 each missing
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
- Compare entity names case-insensitively
- A student entity matches if it's conceptually equivalent (e.g., "Customer" matches "Customers")

CRITICAL LANGUAGE RULES:
- "overallComment" and "correctParts" MUST be in Thai (ภาษาไทย)
- Use casual, friendly Thai — like a teacher giving feedback to a student
- Use ภาษาพูด ที่เข้าใจง่าย เหมือนอาจารย์ comment งานนักศึกษา
- Example overallComment: "ทำได้ดีเลยนะ แค่ขาด entity สำหรับ payment ไป ลองเพิ่มดู"
- Example correctParts: "สร้าง Customer กับ Order ได้ถูกต้อง", "ใส่ PK ครบทุก entity ดีมาก"`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			return body.scenario && body.idealSolution && body.userSolution;
		},
		buildMessages: (body) => {
			const { scenario, requirements, idealSolution, userSolution } = body;
			const userMsg = `Grade this student's ER diagram solution.

SCENARIO:
${scenario}

REQUIREMENTS:
${(requirements || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

IDEAL SOLUTION:
Entities: ${JSON.stringify(idealSolution.entities)}
Relationships: ${JSON.stringify(idealSolution.relationships)}

STUDENT'S SOLUTION:
Entities: ${JSON.stringify(userSolution.entities)}
Relationships: ${JSON.stringify(userSolution.relationships)}`;

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
