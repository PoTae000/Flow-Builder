import type { RequestHandler } from '@sveltejs/kit';
import { aiRequest } from '$lib/server/ai-request';

function buildSystemPrompt(diagramType: string): string {
	const diagramLabel = diagramType === 'flowchart' ? 'Flowchart'
		: diagramType === 'context' ? 'Data Flow Diagram'
		: 'ER Diagram';

	return `คุณเป็นผู้เชี่ยวชาญวางแผนการสร้าง ${diagramLabel}

เมื่อได้รับเป้าหมาย ให้วางแผน 3-6 ขั้นตอนเพื่อสร้าง diagram ที่สมบูรณ์
- ขั้นตอนสุดท้า���ต้องเป็น auto-layout เสมอ
- แต่ละขั้นตอนต้องมี label (แสดง UI) และ instruction (ส่งให้ AI ทำ)
- ถ้ามี diagram ปัจจุบัน ให้ต่อยอดจากที่มีอยู่
- ไม่ต้องสร้าง entity/node ซ้ำกับที่มีอยู่แล้ว

ตอบเป็น JSON:
{
  "steps": [
    { "label": "สร้าง Entity หลัก", "instruction": "สร้าง entity Customer, Order, Product พร้อม primary key และ attributes พื้นฐาน" },
    { "label": "เพิ่มความสัมพันธ์", "instruction": "เพิ่ม relationship ระหว่าง Customer-Order (1:N), Order-Product (M:N)" },
    { "label": "จัดวาง Layout", "instruction": "auto-layout" }
  ]
}`;
}

function buildContext(body: any): string {
	const { goal, diagramType } = body;
	let ctx = `เป้าหมาย: ${goal}\nDiagram Type: ${diagramType}\n`;

	const diagram = body.currentDiagram || {};

	if (diagramType === 'flowchart') {
		if (diagram.flowNodes?.length) {
			ctx += '\nDiagram ปัจจุบัน:\n';
			for (const n of diagram.flowNodes) ctx += `- Node: ${n.name} [${n.type}]\n`;
			for (const e of diagram.flowEdges || []) ctx += `- Edge: ${e.fromNode} → ${e.toNode}\n`;
		} else {
			ctx += '\nDiagram ว่าง (สร้างใหม่)\n';
		}
	} else if (diagramType === 'context') {
		if (diagram.dfdNodes?.length) {
			ctx += '\nDiagram ปัจจุบัน:\n';
			for (const n of diagram.dfdNodes) ctx += `- Node: ${n.name} [${n.type}]\n`;
			for (const f of diagram.dfdFlows || []) ctx += `- Flow: ${f.fromNode} → ${f.toNode}\n`;
		} else {
			ctx += '\nDiagram ว่าง (สร้างใหม่)\n';
		}
	} else {
		if (diagram.entities?.length) {
			ctx += '\nDiagram ปัจจุบัน:\n';
			for (const e of diagram.entities) {
				const attrs = (e.attributes || []).map((a: any) => `${a.name}[${a.type}]`).join(', ');
				ctx += `- Entity: ${e.name} (${attrs})\n`;
			}
			for (const r of diagram.relationships || []) {
				ctx += `- Rel: ${r.from} -[${r.cardFrom}]- ${r.name} -[${r.cardTo}]- ${r.to}\n`;
			}
		} else {
			ctx += '\nDiagram ว่าง (สร้างใหม่)\n';
		}
	}

	return ctx;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			if (!body.goal || typeof body.goal !== 'string') return false;
			if (!body.diagramType) return false;
			return true;
		},
		buildMessages: (body) => {
			return [
				{ role: 'system', content: buildSystemPrompt(body.diagramType) },
				{ role: 'user', content: buildContext(body) }
			];
		},
		temperature: 0.3,
		maxTokens: 2048,
		jsonMode: true
	});
};
