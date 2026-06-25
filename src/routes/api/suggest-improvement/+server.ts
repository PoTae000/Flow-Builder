import type { RequestHandler } from '@sveltejs/kit';
import { aiRequest } from '$lib/server/ai-request';
import { buildCompactDiagramDescription } from '$lib/utils/diagram-description';
import { validateEntityLimits } from '$lib/server/ai-limits';
import type { DiagramType } from '$lib/types/diagram';

const ER_PROMPT = `คุณเป็นผู้เชี่ยวชาญด้านการออกแบบฐานข้อมูลและ ER Diagram

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

const DFD_PROMPT = `คุณเป็นผู้เชี่ยวชาญด้าน DFD (Data Flow Diagram) / Context Diagram

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
- เน้นเรื่อง: missing data flows, data store ที่ขาด, process numbering, external entity ที่ขาด, flow labeling
- text ต้องสั้นกระชับ ใช้เป็น chip label ได้
- ถ้า diagram ดีอยู่แล้ว ให้แนะนำ optimization เล็กน้อย`;

const FLOWCHART_PROMPT = `คุณเป็นผู้เชี่ยวชาญด้าน Flowchart

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
- เน้นเรื่อง: missing start/end, decision branching, edge labels, flow logic
- text ต้องสั้นกระชับ ใช้เป็น chip label ได้
- ถ้า diagram ดีอยู่แล้ว ให้แนะนำ optimization เล็กน้อย`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			const type: DiagramType = body.diagramType || 'er';
			if (type === 'context') {
				return Array.isArray(body.dfdNodes) && body.dfdNodes.length >= 2;
			}
			if (type === 'flowchart') {
				return Array.isArray(body.flowNodes) && body.flowNodes.length >= 2;
			}
			if (!Array.isArray(body.entities) || body.entities.length < 3) return false;
			return validateEntityLimits(body);
		},
		buildMessages: (body) => {
			const type: DiagramType = body.diagramType || 'er';

			if (type === 'context') {
				let desc = 'Nodes:\n';
				for (const n of body.dfdNodes || []) {
					desc += `- ${n.name} [${n.type}]`;
					if (n.processNumber) desc += ` #${n.processNumber}`;
					if (n.storeNumber) desc += ` ${n.storeNumber}`;
					desc += '\n';
				}
				desc += '\nFlows:\n';
				for (const f of body.dfdFlows || []) {
					desc += `- ${f.fromNode || '?'} → ${f.toNode || '?'} [${f.label || ''}]\n`;
				}
				return [
					{ role: 'system', content: DFD_PROMPT },
					{ role: 'user', content: `วิเคราะห์ Context Diagram นี้:\n${desc}` }
				];
			}

			if (type === 'flowchart') {
				let desc = 'Nodes:\n';
				for (const n of body.flowNodes || []) {
					desc += `- ${n.name} [${n.type}]\n`;
				}
				desc += '\nEdges:\n';
				for (const e of body.flowEdges || []) {
					desc += `- ${e.fromNode || '?'} → ${e.toNode || '?'} [${e.label || ''}]\n`;
				}
				return [
					{ role: 'system', content: FLOWCHART_PROMPT },
					{ role: 'user', content: `วิเคราะห์ Flowchart นี้:\n${desc}` }
				];
			}

			const { entities, relationships } = body;
			const diagramDesc = buildCompactDiagramDescription(entities, relationships || []);
			return [
				{ role: 'system', content: ER_PROMPT },
				{ role: 'user', content: `วิเคราะห์ ER Diagram นี้:\n${diagramDesc}` }
			];
		},
		temperature: 0.5,
		maxTokens: 512,
		jsonMode: true
	});
};
