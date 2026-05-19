import type { RequestHandler } from '@sveltejs/kit';
import { aiRequest } from '$lib/server/ai-request';
import { buildCompactDiagramDescription } from '$lib/utils/diagram-description';
import { validateEntityLimits } from '$lib/server/ai-limits';

const SYSTEM_PROMPT = `คุณเป็นผู้เชี่ยวชาญด้านการออกแบบฐานข้อมูลและ ER Diagram

วิเคราะห์ diagram ที่ให้มา แล้วแนะนำ 2-3 จุดที่ควรปรับปรุง
ตอบเป็น JSON เท่านั้น ในรูปแบบ:
{
  "suggestions": [
    { "text": "คำแนะนำสั้นๆ (ไม่เกิน 30 ตัวอักษร)", "detail": "รายละเอียดเพิ่มเติม 1-2 ประโยค" }
  ]
}

กฎ:
- แนะนำ 2-3 ข้อเท่านั้น
- ใช้ภาษาไทย
- เน้นเรื่อง: normalization, missing keys, cardinality, naming convention, missing relationships
- text ต้องสั้นกระชับ ใช้เป็น chip label ได้
- ถ้า diagram ดีอยู่แล้ว ให้แนะนำ optimization เล็กน้อย`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			if (!Array.isArray(body.entities) || body.entities.length < 3) return false;
			return validateEntityLimits(body);
		},
		buildMessages: (body) => {
			const { entities, relationships } = body;
			const diagramDesc = buildCompactDiagramDescription(entities, relationships || []);

			return [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: `วิเคราะห์ ER Diagram นี้:\n${diagramDesc}` }
			];
		},
		temperature: 0.5,
		maxTokens: 512,
		jsonMode: true
	});
};
