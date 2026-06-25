import type { RequestHandler } from '@sveltejs/kit';
import { aiRequest } from '$lib/server/ai-request';

function buildSystemPrompt(diagramType: string): string {
	if (diagramType === 'flowchart') {
		return `คุณเป็นผู้เชี่ยวชาญ Flowchart ให้สร้าง actions ตาม instruction ที่ได้รับ

ตอบเป็น JSON:
{
  "actions": [
    { "op": "add-flow-node", "name": "NodeName", "type": "process"|"decision"|"start-end"|"input-output"|"connector"|"document"|"database" },
    { "op": "add-flow-edge", "label": "edge label", "fromNode": "NodeA", "toNode": "NodeB", "condition": "yes"|"no"|null },
    { "op": "remove-flow-node", "name": "NodeName" },
    { "op": "remove-flow-edge", "fromNode": "NodeA", "toNode": "NodeB" }
  ]
}

กฎ:
- ใช้ภาษาเดียวกับ diagram ที่มีอยู่ (ถ้าว่าง ใช้อังกฤษ)
- ห้ามสร้าง node ซ้ำชื่อที่มีอยู่แล้ว
- fromNode/toNode ต้องเป็นชื่อ node ที่มีอยู่แล้วหรือที่เพิ่งสร้างใน actions ชุดนี้
- decision node ต้องมี edge ออกอย่างน้อย yes/no`;
	}

	if (diagramType === 'context') {
		return `คุณเป็นผู้เชี่ยวชาญ Data Flow Diagram ให้สร้าง actions ตาม instruction ที่ได้รับ

ตอบเป็น JSON:
{
  "actions": [
    { "op": "add-dfd-node", "name": "NodeName", "type": "process"|"external-entity"|"data-store", "processNumber": "1.0", "storeNumber": "D1" },
    { "op": "add-dfd-flow", "label": "flow label", "fromNode": "NodeA", "toNode": "NodeB" },
    { "op": "remove-dfd-node", "name": "NodeName" },
    { "op": "remove-dfd-flow", "fromNode": "NodeA", "toNode": "NodeB" }
  ]
}

กฎ:
- ใช้ภาษาเดียวกับ diagram ที่มีอยู่ (ถ้าว่าง ใช้อังกฤษ)
- ห้ามสร้าง node ซ้ำชื่อที่มีอยู่แล้ว
- fromNode/toNode ต้องเป็นชื่อ node ที่มีอยู่แล้วหรือที่เพิ่งสร้างใน actions ชุดนี้
- process ต้องมี processNumber
- data-store ต้องมี storeNumber (D1, D2, ...)`;
	}

	return `คุณเป็นผู้เชี่ยวชาญ ER Diagram ให้สร้าง actions ตาม instruction ที่ได้รับ

ตอบเป็น JSON:
{
  "actions": [
    { "op": "add-entity", "name": "EntityName", "attributes": [{"name": "id", "type": "primary_key"}, {"name": "field", "type": "regular"}], "isWeak": false },
    { "op": "add-relationship", "name": "rel_name", "from": "EntityA", "to": "EntityB", "cardFrom": "1", "cardTo": "N", "isIdentifying": false },
    { "op": "add-attribute", "entityName": "EntityName", "attribute": {"name": "new_attr", "type": "regular"} },
    { "op": "remove-entity", "name": "EntityName" },
    { "op": "remove-relationship", "name": "rel_name" },
    { "op": "rename-entity", "name": "OldName", "newName": "NewName" }
  ]
}

Attribute type: "primary_key", "foreign_key", "regular", "partial_key", "derived", "multivalued", "composite"
Cardinality: "1", "N", "M", "0..1", "0..N", "1..1", "1..N"

กฎ:
- ใช้ภาษาเดียวกับ entity ที่มีอยู่ (ถ้าว่าง ใช้อังกฤษ)
- ทุก entity ต้องมี primary_key attribute
- ห้ามสร้าง entity ซ้ำชื่อที่มีอยู่แล้ว
- from/to ต้องเป็นชื่อ entity ที่มีอยู่แล้วหรือที่เพิ่งสร้างใน actions ชุดนี้
- ใช้ PascalCase สำหรับ entity, snake_case สำหรับ attributes`;
}

function buildContext(body: any): string {
	const { instruction, diagramType } = body;
	const diagram = body.currentDiagram || {};
	let ctx = `Instruction: ${instruction}\n\nDiagram ปัจจุบัน:\n`;

	if (diagramType === 'flowchart') {
		if (diagram.flowNodes?.length) {
			for (const n of diagram.flowNodes) ctx += `- Node: ${n.name} [${n.type}]\n`;
			for (const e of diagram.flowEdges || []) {
				ctx += `- Edge: ${e.fromNode} → ${e.toNode}`;
				if (e.label) ctx += ` [${e.label}]`;
				if (e.condition) ctx += ` (${e.condition})`;
				ctx += '\n';
			}
		} else {
			ctx += '(ว่าง)\n';
		}
	} else if (diagramType === 'context') {
		if (diagram.dfdNodes?.length) {
			for (const n of diagram.dfdNodes) {
				ctx += `- Node: ${n.name} [${n.type}]`;
				if (n.processNumber) ctx += ` #${n.processNumber}`;
				if (n.storeNumber) ctx += ` ${n.storeNumber}`;
				ctx += '\n';
			}
			for (const f of diagram.dfdFlows || []) {
				ctx += `- Flow: ${f.fromNode} → ${f.toNode}`;
				if (f.label) ctx += ` [${f.label}]`;
				ctx += '\n';
			}
		} else {
			ctx += '(ว่าง)\n';
		}
	} else {
		if (diagram.entities?.length) {
			for (const e of diagram.entities) {
				const attrs = (e.attributes || []).map((a: any) => `${a.name}[${a.type}]`).join(', ');
				ctx += `- Entity: ${e.name} (${attrs})${e.isWeak ? ' [weak]' : ''}\n`;
			}
			for (const r of diagram.relationships || []) {
				ctx += `- Rel: ${r.from} -[${r.cardFrom}]- ${r.name} -[${r.cardTo}]- ${r.to}`;
				if (r.isIdentifying) ctx += ' (identifying)';
				ctx += '\n';
			}
		} else {
			ctx += '(ว่าง)\n';
		}
	}

	return ctx;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			if (!body.instruction || typeof body.instruction !== 'string') return false;
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
		maxTokens: 4096,
		jsonMode: true
	});
};
