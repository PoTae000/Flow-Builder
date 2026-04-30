import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { checkRateLimit } from '$lib/server/rate-limit';
import { getClientIp, aiRequest } from '$lib/server/ai-request';
import { buildDiagramDescription } from '$lib/utils/diagram-description';
import { buildUnifiedDiagramDescription } from '$lib/utils/diagram-description-multi';
import { getAnalysisSystemPrompt } from '$lib/server/analysis-rules';
import { validateEntityLimits } from '$lib/server/ai-limits';
import type { DiagramType } from '$lib/types/diagram';

const ANALYSIS_PROMPT = `You are an expert database architect and ER diagram reviewer. Analyze the given ER diagram data and provide a thorough review.

You MUST return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "score": 75,
  "summary": "Overall assessment in 1-2 sentences",
  "issues": [
    {
      "severity": "error",
      "title": "Short issue title",
      "description": "What is wrong",
      "reason": "Why this is a problem — explain the database design principle being violated",
      "fix": "Specific instructions on how to fix it — tell exactly what to change"
    }
  ],
  "suggestions": [
    "Improvement suggestion 1",
    "Improvement suggestion 2"
  ]
}

Rules for analysis:
1. **Primary Keys**: Every entity MUST have at least one primary_key attribute. If missing, it's an error.
2. **Naming Conventions**: Entity names should be PascalCase or singular nouns. Attribute names should be consistent (snake_case or camelCase). Flag inconsistencies.
3. **Cardinality**: Check if cardinalities make logical sense. For example, a Student "enrolls" in a Course should be M:N, not 1:1.
4. **Normalization**: Check for potential normalization issues:
   - 1NF: multivalued attributes that should be separate entities
   - 2NF: partial dependencies in composite key entities
   - 3NF: transitive dependencies
5. **Redundant Relationships**: Flag if two entities have duplicate relationships.
6. **Missing Relationships**: If entities logically should be related but aren't, suggest it.
7. **Weak Entities**: Check if weak entities are properly identified with identifying relationships.
8. **Foreign Keys**: FK attributes should reference existing entities.
9. **Attribute Types**: Check if attribute types are appropriate (e.g., derived attributes used correctly).
10. **Orphan Entities**: Entities with no relationships might indicate missing connections.

Severity levels:
- "error": Violates database design rules, MUST be fixed
- "warning": Potential issue, SHOULD be reviewed
- "info": Suggestion for improvement

Score guidelines:
- 90-100: Excellent design, minor suggestions only
- 70-89: Good design with some issues
- 50-69: Acceptable but needs improvement
- 30-49: Significant issues
- 0-29: Major design problems

IMPORTANT: For each issue, always explain:
1. What is wrong (description)
2. Why it's wrong — what principle or best practice is violated (reason)
3. How to fix it — give specific actionable steps (fix)

CRITICAL LANGUAGE & TONE RULES:
- ALL text values (summary, title, description, reason, fix, suggestions) MUST be in Thai.
- Use casual, friendly Thai — like a friend explaining to a friend. NOT formal/textbook language.
- Use ภาษาพูด, ภาษาบ้านๆ ที่เข้าใจง่าย เหมือนเพื่อนคุยกัน
- Example tone: "ตรงนี้ยังไม่มี Primary Key นะ ถ้าไม่มีมันจะหา row ที่ต้องการไม่ได้เลย ลองเพิ่ม id เป็น PK ดู"
- DO NOT use formal/academic language like "จำเป็นต้องกำหนด" or "ควรพิจารณา" — use "ลองเพิ่ม...", "ตรงนี้ขาด...", "แก้ง่ายๆ แค่..."
- Keep it short, direct, and easy to understand.`;

export const POST: RequestHandler = async ({ request, platform }) => {
	const body: any = await request.json();

	// M2: Body size check — prevent oversized payloads that bypass aiRequest's check
	// (analyze reconstructs Request, so aiRequest's text()-based check sees the re-serialized body)
	const bodySize = new TextEncoder().encode(JSON.stringify(body)).byteLength;
	if (bodySize > 1 * 1024 * 1024) {
		throw error(413, 'Request body too large');
	}

	// Determine diagram type
	const diagramType: DiagramType = body.diagramType || 'er';

	// M3: Entity/Node count limits
	if (!validateEntityLimits(body)) {
		throw error(400, 'ข้อมูลมีขนาดเกินขีดจำกัด (entities ≤ 100, attributes ≤ 200/entity, relationships ≤ 200)');
	}

	// Check for empty diagram
	const isEmpty = (diagramType === 'er' && Array.isArray(body.entities) && body.entities.length === 0) ||
		(diagramType === 'flowchart' && Array.isArray(body.flowNodes) && body.flowNodes.length === 0) ||
		(diagramType === 'context' && Array.isArray(body.dfdNodes) && body.dfdNodes.length === 0);

	if (isEmpty) {
		// Rate limit even for empty entity requests to prevent abuse
		let userSub: string | null = null;
		try {
			const payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
			userSub = payload.sub;
		} catch { /* anonymous */ }

		const kv = platform?.env?.DIAGRAMS_KV;
		const identifier = userSub || `ip:${getClientIp(request)}`;
		const limit = userSub ? 20 : 5;
		const { allowed } = await checkRateLimit(kv, identifier, limit);
		if (!allowed) {
			throw error(429, 'Rate limit exceeded');
		}

		const emptyMessage = diagramType === 'er' ? 'ยังไม่มี Entity เลย ลองเพิ่ม Entity ก่อนแล้วค่อยวิเคราะห์นะ' :
			diagramType === 'flowchart' ? 'ยังไม่มี Node เลย ลองเพิ่ม Node ก่อนแล้วค่อยวิเคราะห์นะ' :
			'ยังไม่มี Node เลย ลองเพิ่ม Node ก่อนแล้วค่อยวิเคราะห์นะ';

		const emptySuggestion = diagramType === 'er' ? 'เพิ่ม Entity อย่างน้อย 2 ตัวเพื่อเริ่มวิเคราะห์' :
			diagramType === 'flowchart' ? 'เพิ่ม Node อย่างน้อย Start, Process, และ End เพื่อเริ่มวิเคราะห์' :
			'เพิ่ม Process และ External Entity อย่างน้อย 1 ตัวเพื่อเริ่มวิเคราะห์';

		return new Response(JSON.stringify({
			score: 0,
			summary: emptyMessage,
			issues: [],
			suggestions: [emptySuggestion]
		}), { headers: { 'Content-Type': 'application/json' } });
	}

	return aiRequest({
		request: new Request(request.url, {
			method: 'POST',
			headers: request.headers,
			body: JSON.stringify(body)
		}),
		platform,
		validateBody: (b) => {
			const type: DiagramType = b.diagramType || 'er';
			if (type === 'er') return Array.isArray(b.entities);
			if (type === 'flowchart') return Array.isArray(b.flowNodes);
			if (type === 'context') return Array.isArray(b.dfdNodes);
			return false;
		},
		buildMessages: (b) => {
			const type: DiagramType = b.diagramType || 'er';

			// Build diagram description based on type
			let diagramDescription: string;
			if (type === 'er') {
				// Use legacy builder for backward compatibility
				const { entities, relationships } = b;
				diagramDescription = buildDiagramDescription(entities, relationships || []);
			} else {
				// Use unified builder for flowchart/DFD
				diagramDescription = buildUnifiedDiagramDescription(type, b);
			}

			// Get type-specific system prompt
			const systemPrompt = type === 'er' ? ANALYSIS_PROMPT : getAnalysisSystemPrompt(type);

			const typeLabel = type === 'er' ? 'ER diagram' :
				type === 'flowchart' ? 'Flowchart' : 'DFD';

			return [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: `Analyze this ${typeLabel}:\n\n${diagramDescription}` }
			];
		},
		temperature: 0.3
	});
};
