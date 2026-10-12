import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { aiRequest } from '$lib/server/ai-request';
import { buildDiagramDescription } from '$lib/utils/diagram-description';
import { buildUnifiedDiagramDescription } from '$lib/utils/diagram-description-multi';
import { validateEntityLimits } from '$lib/server/ai-limits';
import type { DiagramType } from '$lib/types/diagram';

const EXPLAIN_PROMPT = `You are an expert systems analyst who explains diagrams to people in plain, friendly language.

Given a diagram (ER diagram, flowchart, or data flow diagram), write a clear explanation that a non-expert can understand. Structure your answer in Markdown with these sections:

## ภาพรวม
1-2 ประโยคว่า diagram นี้เกี่ยวกับอะไร ระบบอะไร

## องค์ประกอบหลัก
อธิบายเอนทิตี/โหนดสำคัญ ๆ ว่าแต่ละอันคืออะไร ทำหน้าที่อะไร (bullet list)

## ความสัมพันธ์ / ลำดับการทำงาน
- สำหรับ ER: อธิบายความสัมพันธ์ระหว่างเอนทิตีเป็นประโยคภาษาคน เช่น "ลูกค้าหนึ่งคนสั่งซื้อได้หลายออเดอร์"
- สำหรับ Flowchart: เล่าลำดับการทำงานตั้งแต่ต้นจนจบเป็น step ๆ
- สำหรับ DFD: อธิบายว่าข้อมูลไหลจากไหนไปไหน

## Business Rules / ข้อสังเกต
กฎเชิงธุรกิจหรือข้อสังเกตที่อ่านได้จาก diagram (ถ้ามี)

CRITICAL RULES:
- เขียนเป็นภาษาไทยทั้งหมด ใช้ภาษาพูดที่เข้าใจง่าย เหมือนอธิบายให้เพื่อนฟัง
- อ้างอิงชื่อจริงจาก diagram (ชื่อเอนทิตี/โหนด) เสมอ
- อย่าแต่งข้อมูลที่ไม่มีใน diagram
- ตอบเป็น Markdown เท่านั้น ไม่ต้องมีคำนำหน้าหรือปิดท้ายเพิ่มเติม`;

export const POST: RequestHandler = async ({ request }) => {
	const body: any = await request.json();

	const bodySize = new TextEncoder().encode(JSON.stringify(body)).byteLength;
	if (bodySize > 1 * 1024 * 1024) {
		throw error(413, 'Request body too large');
	}

	const diagramType: DiagramType = body.diagramType || 'er';

	if (!validateEntityLimits(body)) {
		throw error(400, 'ข้อมูลมีขนาดเกินขีดจำกัด');
	}

	const isEmpty = (diagramType === 'er' && Array.isArray(body.entities) && body.entities.length === 0) ||
		(diagramType === 'flowchart' && Array.isArray(body.flowNodes) && body.flowNodes.length === 0) ||
		(diagramType === 'context' && Array.isArray(body.dfdNodes) && body.dfdNodes.length === 0);

	if (isEmpty) {
		return new Response(JSON.stringify({
			content: 'ยังไม่มีอะไรใน diagram เลย ลองเพิ่มองค์ประกอบก่อนแล้วค่อยให้ AI อธิบายนะ'
		}), { headers: { 'Content-Type': 'application/json' } });
	}

	return aiRequest({
		request: new Request(request.url, {
			method: 'POST',
			headers: request.headers,
			body: JSON.stringify(body)
		}),
		validateBody: (b) => {
			const type: DiagramType = b.diagramType || 'er';
			if (type === 'er') return Array.isArray(b.entities);
			if (type === 'flowchart') return Array.isArray(b.flowNodes);
			if (type === 'context') return Array.isArray(b.dfdNodes);
			return false;
		},
		buildMessages: (b) => {
			const type: DiagramType = b.diagramType || 'er';
			let description: string;
			if (type === 'er') {
				description = buildDiagramDescription(b.entities, b.relationships || []);
			} else {
				description = buildUnifiedDiagramDescription(type, b);
			}
			const typeLabel = type === 'er' ? 'ER diagram' : type === 'flowchart' ? 'Flowchart' : 'DFD';
			return [
				{ role: 'system', content: EXPLAIN_PROMPT },
				{ role: 'user', content: `Explain this ${typeLabel}:\n\n${description}` }
			];
		},
		temperature: 0.5,
		jsonMode: false
	});
};
