import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { buildCompactDiagramDescription } from '$lib/utils/diagram-description';

const SYSTEM_PROMPT = `คุณเป็นผู้เชี่ยวชาญด้านการออกแบบฐานข้อมูลและ ER Diagram ตอบเป็นภาษาไทย สไตล์เพื่อนคุยกัน ไม่ต้องเป็นทางการ

คุณมีความสามารถ:
1. วิเคราะห์ ER Diagram ที่ผู้ใช้สร้าง
2. แนะนำการปรับปรุง (เพิ่ม Entity, Attribute, Relationship)
3. ตอบคำถามเกี่ยวกับ Normalization, Keys, Cardinality
4. ช่วยออกแบบ database ใหม่จากความต้องการ
5. อธิบายแนวคิดฐานข้อมูลแบบเข้าใจง่าย

กฎ:
- ตอบสั้นกระชับ ตรงประเด็น
- ถ้าผู้ใช้ถามเรื่อง diagram ปัจจุบัน ให้อ้างอิงข้อมูล Entity/Relationship ที่ได้รับ
- ใช้ภาษาพูดง่ายๆ เหมือนเพื่อนอธิบายให้เพื่อน
- ถ้าแนะนำให้เปลี่ยนแปลง diagram ให้บอกชัดเจนว่าต้องทำอะไร`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => Array.isArray(body.messages) && body.messages.length > 0,
		buildMessages: (body) => {
			const { messages, entities, relationships } = body;

			let diagramContext = '';
			if (entities && entities.length > 0) {
				diagramContext = `\n\n--- Diagram ปัจจุบัน ---\n${buildCompactDiagramDescription(entities, relationships || [])}`;
			}

			return [
				{ role: 'system', content: SYSTEM_PROMPT + diagramContext },
				...messages.slice(-10)
			];
		},
		temperature: 0.5,
		maxTokens: 2048,
		jsonMode: false
	});
};
