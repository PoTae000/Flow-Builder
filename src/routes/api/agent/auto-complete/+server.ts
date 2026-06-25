import type { RequestHandler } from '@sveltejs/kit';
import { aiRequest } from '$lib/server/ai-request';

function buildSystemPrompt(diagramType: string): string {
	if (diagramType === 'flowchart') {
		return `คุณเป็นผู้เชี่ยวชาญ Flowchart ให้แนะนำ 2-4 สิ่งที่ควรเพิ่มใน diagram จาก diagram ปัจจุบัน

ตอบเป็น JSON:
{
  "suggestions": [
    {
      "label": "ชื่อสั้นๆ ของข้อแนะนำ",
      "description": "คำอธิบายสั้นว่าทำไมควรเพิ่ม",
      "actions": [
        { "op": "add-flow-node", "name": "NodeName", "type": "process"|"decision"|"start-end"|"input-output"|... },
        { "op": "add-flow-edge", "label": "edge label", "fromNode": "ExistingNode", "toNode": "NewNode", "condition": null }
      ]
    }
  ]
}

Node types: "start-end", "process", "decision", "input-output", "connector", "document", "database"
กฎ:
- แนะนำ 2-4 items
- ใช้ภาษาเดียวกับ diagram ที่มีอยู่
- actions ต้องใช้ชื่อ node ที่มีอยู่แล้วเพื่อ connect
- แต่ละ suggestion ควรเพิ่ม 1-3 actions`;
	}

	if (diagramType === 'context') {
		return `คุณเป็นผู้เชี่ยวชาญ Data Flow Diagram ให้แนะนำ 2-4 สิ่งที่ควรเพิ่มใน diagram จาก diagram ปัจจุบัน

ตอบเป็น JSON:
{
  "suggestions": [
    {
      "label": "ชื่อสั้นๆ ของข้อแนะนำ",
      "description": "คำอธิบายสั้นว่าทำไมควรเพิ่ม",
      "actions": [
        { "op": "add-dfd-node", "name": "NodeName", "type": "process"|"external-entity"|"data-store", "processNumber": "1.0", "storeNumber": "D1" },
        { "op": "add-dfd-flow", "label": "flow label", "fromNode": "ExistingNode", "toNode": "NewNode" }
      ]
    }
  ]
}

กฎ:
- แนะนำ 2-4 items
- ใช้ภาษาเดียวกับ diagram ที่มีอยู่
- actions ต้องใช้ชื่อ node ที่มีอยู่แล้วเพื่อ connect
- แต่ละ suggestion ควรเพิ่ม 1-3 actions`;
	}

	return `คุณเป็นผู้เชี่ยวชาญ ER Diagram ให้แนะนำ 2-4 สิ่งที่ควรเพิ่มใน diagram จาก diagram ปัจจุบัน

ตอบเป็น JSON:
{
  "suggestions": [
    {
      "label": "ชื่อสั้นๆ ของข้อแนะนำ",
      "description": "คำอธิบายสั้นว่าทำไมควรเพิ่ม",
      "actions": [
        { "op": "add-entity", "name": "EntityName", "attributes": [{"name": "id", "type": "primary_key"}, {"name": "field", "type": "regular"}], "isWeak": false },
        { "op": "add-relationship", "name": "rel_name", "from": "ExistingEntity", "to": "NewEntity", "cardFrom": "1", "cardTo": "N", "isIdentifying": false }
      ]
    }
  ]
}

Attribute type: "primary_key", "foreign_key", "regular", "partial_key", "derived", "multivalued", "composite"
Cardinality: "1", "N", "M", "0..1", "0..N", "1..1", "1..N"

กฎ:
- แนะนำ 2-4 items
- ใช้ภาษาเดียวกับ entity ที่มีอยู่แล้ว
- ทุก entity ต้องมี primary_key
- actions ต้องใช้ชื่อ entity ที่มีอยู่แล้วใน relationship
- แต่ละ suggestion ควรเพิ่ม 1-3 actions`;
}

function buildContext(body: any): string {
	const { diagramType, recentAction } = body;
	let ctx = `Recent action: ${recentAction || 'unknown'}\n\nDiagram ปัจจุบัน:\n`;

	if (diagramType === 'flowchart') {
		for (const n of body.flowNodes || []) {
			ctx += `- Node: ${n.name} [${n.type}]\n`;
		}
		for (const e of body.flowEdges || []) {
			ctx += `- Edge: ${e.fromNode} → ${e.toNode}`;
			if (e.label) ctx += ` [${e.label}]`;
			ctx += '\n';
		}
	} else if (diagramType === 'context') {
		for (const n of body.dfdNodes || []) {
			ctx += `- Node: ${n.name} [${n.type}]`;
			if (n.processNumber) ctx += ` #${n.processNumber}`;
			if (n.storeNumber) ctx += ` ${n.storeNumber}`;
			ctx += '\n';
		}
		for (const f of body.dfdFlows || []) {
			ctx += `- Flow: ${f.fromNode} → ${f.toNode}`;
			if (f.label) ctx += ` [${f.label}]`;
			ctx += '\n';
		}
	} else {
		for (const e of body.entities || []) {
			const attrs = (e.attributes || []).map((a: any) => `${a.name}[${a.type}]`).join(', ');
			ctx += `- Entity: ${e.name} (${attrs})\n`;
		}
		for (const r of body.relationships || []) {
			ctx += `- Rel: ${r.from} -[${r.cardFrom}]- ${r.name} -[${r.cardTo}]- ${r.to}\n`;
		}
	}

	return ctx;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			if (!body.diagramType) return false;
			return true;
		},
		buildMessages: (body) => {
			return [
				{ role: 'system', content: buildSystemPrompt(body.diagramType) },
				{ role: 'user', content: buildContext(body) }
			];
		},
		temperature: 0.4,
		maxTokens: 2048,
		jsonMode: true
	});
};
