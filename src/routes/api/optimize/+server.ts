import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { checkRateLimit } from '$lib/server/rate-limit';
import { getClientIp, aiRequest } from '$lib/server/ai-request';
import { buildDiagramDescription } from '$lib/utils/diagram-description';
import { validateEntityLimits } from '$lib/server/ai-limits';

const OPTIMIZE_PROMPT = `You are a senior database performance engineer. Given an ER diagram, propose concrete, actionable optimizations for the physical database: indexes, normalization/denormalization, and query patterns.

You MUST return ONLY valid JSON (no markdown, no explanation) in this EXACT format:
{
  "summary": "1-2 sentence overview of the schema's performance profile",
  "indexes": [
    {
      "table": "Orders",
      "columns": ["customer_id"],
      "kind": "index",
      "reason": "Why this index helps — which queries/joins it speeds up",
      "sql": "CREATE INDEX idx_orders_customer_id ON Orders (customer_id);"
    }
  ],
  "normalization": [
    {
      "kind": "normalize",
      "target": "Entity or attribute name",
      "issue": "What's wrong now",
      "suggestion": "What to change and the trade-off"
    }
  ],
  "queryTips": [
    {
      "title": "Short tip title",
      "detail": "The problem and the fix — e.g. avoid N+1, use covering index, paginate"
    }
  ]
}

Analysis rules:
1. **Foreign-key indexes**: Every foreign_key attribute SHOULD have an index — joins and lookups on unindexed FKs cause full scans. Propose one per FK column that lacks an obvious index. Primary keys are already indexed — do NOT propose indexes on primary_key columns.
2. **Composite indexes**: If two columns are frequently filtered together (e.g. a junction/associative entity's two FKs, or status+date), propose a composite index and explain column order (most selective / equality columns first).
3. **Unique indexes**: Natural-key or business-unique columns (email, username, slug, code) should get a UNIQUE index.
4. **High-cardinality lookup columns**: Columns that look like search/filter targets (name, email, date, status) benefit from an index. Use judgement from the attribute names.
5. **Normalization**: Flag multivalued/composite attributes that violate 1NF (should become separate tables), transitive dependencies (3NF), and repeating groups.
6. **Denormalization**: Where a read-heavy pattern would benefit (e.g. storing a computed count or a frequently-joined display name), suggest it with the write-cost trade-off called out.
7. **Query tips**: Point out likely N+1 patterns (parent → many children fetched in a loop), missing pagination on large tables, and cases where a covering index avoids a table lookup.

Index "kind" MUST be one of: "index", "composite", "unique".
Normalization "kind" MUST be one of: "normalize", "denormalize".

Only propose changes that are justified by the schema. If there is nothing to suggest in a category, return an empty array for it. Do NOT invent columns or tables that aren't in the diagram. SQL must reference only the given tables/columns (sanitized names).

CRITICAL LANGUAGE & TONE RULES:
- ALL human-readable text (summary, reason, issue, suggestion, title, detail) MUST be in Thai.
- Use casual, friendly Thai — เหมือนรุ่นพี่สาย DB อธิบายให้รุ่นน้องฟัง. ไม่ต้องทางการ.
- Keep each field short and direct: "ตรงนี้ FK ยังไม่มี index เลย เวลา join จะช้า ลองเพิ่ม index ดู"
- The "sql" field MUST stay valid SQL in English (table/column names + SQL keywords) — do NOT translate SQL.`;

export const POST: RequestHandler = async ({ request }) => {
	const body: any = await request.json();

	
	const bodySize = new TextEncoder().encode(JSON.stringify(body)).byteLength;
	if (bodySize > 1 * 1024 * 1024) {
		throw error(413, 'Request body too large');
	}

	
	if (!Array.isArray(body.entities)) {
		throw error(400, 'ต้องเป็น ER diagram');
	}

	if (!validateEntityLimits({ diagramType: 'er', ...body })) {
		throw error(400, 'ข้อมูลมีขนาดเกินขีดจำกัด (entities ≤ 100, attributes ≤ 200/entity, relationships ≤ 200)');
	}

	
	if (body.entities.length === 0) {
		let userSub: string | null = null;
		try {
			const payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
			userSub = payload.sub;
		} catch { /* anonymous */ }

		const identifier = userSub || `ip:${getClientIp(request)}`;
		const limit = userSub ? 20 : 5;
		const { allowed } = await checkRateLimit(identifier, limit);
		if (!allowed) throw error(429, 'Rate limit exceeded');

		return new Response(JSON.stringify({
			summary: 'ยังไม่มี Entity เลย ลองเพิ่ม Entity + attribute (โดยเฉพาะ FK) ก่อนแล้วค่อยวิเคราะห์นะ',
			indexes: [],
			normalization: [],
			queryTips: []
		}), { headers: { 'Content-Type': 'application/json' } });
	}

	return aiRequest({
		request: new Request(request.url, {
			method: 'POST',
			headers: request.headers,
			body: JSON.stringify(body)
		}),
		validateBody: (b) => Array.isArray(b.entities),
		buildMessages: (b) => {
			const description = buildDiagramDescription(b.entities, b.relationships || []);
			return [
				{ role: 'system', content: OPTIMIZE_PROMPT },
				{ role: 'user', content: `Analyze this ER diagram and propose database optimizations:\n\n${description}` }
			];
		},
		temperature: 0.3
	});
};
