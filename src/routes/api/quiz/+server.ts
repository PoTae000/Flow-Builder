import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { sanitizeName } from '$lib/utils/sanitize';

const QUIZ_PROMPT = `You are an expert database design instructor. Generate an ER diagram quiz question.

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


export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			const validDifficulties = ['easy', 'medium', 'hard'];
			return validDifficulties.includes(body.difficulty);
		},
		buildMessages: (body) => {
			const { difficulty, domain } = body;
			let userMsg = `Generate a ${difficulty} difficulty ER diagram quiz question.`;
			if (domain) {
				userMsg += ` The scenario should be related to: ${sanitizeName(String(domain), 200)}`;
			}
			return [
				{ role: 'system', content: QUIZ_PROMPT },
				{ role: 'user', content: userMsg }
			];
		},
		temperature: 0.5,
		maxTokens: 4096,
		jsonMode: true
	});
};
