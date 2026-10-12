import type { DFDNode, DFDFlow } from '$lib/types/context-diagram';
export interface DFDIssue { code: string; message: string; nodeId?: string; flowId?: string; parentId?: string }
export function validateDFD(nodes: DFDNode[], flows: DFDFlow[]): DFDIssue[] {
	const issues: DFDIssue[] = [];
	const byId = new Map(nodes.map(node => [node.id, node]));
	const root = nodes.filter(node => !node.parentId);
	if (root.filter(node => node.type === 'process').length !== 1) issues.push({ code: 'context-process', message: 'Level 0 ต้องมี Process แทนระบบเพียงหนึ่งตัว' });
	for (const node of nodes) {
		const add = (code: string, message: string) => issues.push({ code, message, nodeId: node.id, parentId: node.parentId });
		if (!node.name.trim()) add('node-name', 'Node ยังไม่มีชื่อ');
		if (!node.parentId && node.type === 'data-store') add('context-store', 'Level 0 ไม่แสดง Data Store ภายในระบบ');
		let depth = 0, parent = node.parentId;
		const seen = new Set([node.id]);
		while (parent) {
			if (seen.has(parent)) { add('cycle', 'โครงสร้าง Level วนกลับหาตัวเอง'); break; }
			seen.add(parent); depth++;
			const ancestor = byId.get(parent);
			if (!ancestor || ancestor.type !== 'process' || ancestor.boundarySourceId) { add('parent', 'Process แม่ไม่ถูกต้อง'); break; }
			parent = ancestor.parentId;
		}
		if (depth > 2) add('depth', 'รองรับการแตก Process ถึง Level 2');
		if (node.boundarySourceId) {
			const source = byId.get(node.boundarySourceId);
			const owner = node.parentId ? byId.get(node.parentId) : undefined;
			if (!source || !owner || source.parentId !== owner.parentId) add('boundary-source', 'จุดอ้างอิงระดับบนไม่ถูกต้อง');
			continue;
		}
		if (node.type === 'process') {
			const number = node.processNumber ?? '';
			const owner = node.parentId ? byId.get(node.parentId) : undefined;
			const prefix = depth === 2 ? (owner?.processNumber ?? '').replace(/\.0$/, '') + '.' : '';
			const valid = depth === 0 ? number === '0' : depth === 1 ? /^[1-9]\d*\.0$/.test(number) : number.startsWith(prefix) && /^[1-9]\d*$/.test(number.slice(prefix.length));
			if (!valid) add('process-number', 'เลข Process ไม่ตรง Level: ใช้ 0, 1.0, 1.1 ตามลำดับ');
			if (nodes.some(other => other.id !== node.id && !other.boundarySourceId && other.type === 'process' && other.parentId === node.parentId && other.processNumber === number)) add('duplicate-number', 'เลข Process ซ้ำใน Level เดียวกัน');
			if (!flows.some(flow => flow.toNodeId === node.id)) add('no-input', 'Process ไม่มีข้อมูลเข้า');
			if (!flows.some(flow => flow.fromNodeId === node.id)) add('no-output', 'Process ไม่มีข้อมูลออก');
		}
	}
	for (const flow of flows) {
		const from = byId.get(flow.fromNodeId), to = byId.get(flow.toNodeId);
		if (!from || !to || from.id === to.id || from.parentId !== flow.parentId || to.parentId !== flow.parentId || (from.type !== 'process' && to.type !== 'process') || (from.boundarySourceId && to.boundarySourceId)) issues.push({ code: 'connection', message: 'เส้นต้องเชื่อมใน Level เดียวกัน ผ่าน Process ภายในอย่างน้อยหนึ่งด้าน', flowId: flow.id, parentId: flow.parentId });
		if (!flow.label.trim()) issues.push({ code: 'flow-name', message: 'เส้นข้อมูลยังไม่มีชื่อ', flowId: flow.id, parentId: flow.parentId });
	}
	for (const owner of nodes.filter(node => node.type === 'process' && !node.boundarySourceId && nodes.some(child => child.parentId === node.id))) {
		const outer = flows.filter(flow => flow.fromNodeId === owner.id || flow.toNodeId === owner.id);
		const inner = flows.filter(flow => flow.parentId === owner.id);
		const signature = (flow: DFDFlow, external: string, direction: string) => `${external}|${direction}|${flow.label.trim()}`;
		const expected = new Set(outer.map(flow => signature(flow, flow.fromNodeId === owner.id ? flow.toNodeId : flow.fromNodeId, flow.fromNodeId === owner.id ? 'out' : 'in')));
		const actual = new Set<string>();
		for (const flow of inner) {
			const from = byId.get(flow.fromNodeId), to = byId.get(flow.toNodeId);
			if (from?.boundarySourceId) actual.add(signature(flow, from.boundarySourceId, 'in'));
			if (to?.boundarySourceId) actual.add(signature(flow, to.boundarySourceId, 'out'));
		}
		for (const entry of expected) if (!actual.has(entry)) issues.push({ code: 'balance-missing', message: 'Level ลูกขาดข้อมูลเข้า–ออกจาก Process แม่: ' + entry.split('|').slice(1).join(' · '), nodeId: owner.id, parentId: owner.id });
		for (const entry of actual) if (!expected.has(entry)) issues.push({ code: 'balance-extra', message: 'Level ลูกมีข้อมูลเข้า–ออกที่ไม่ตรงกับ Process แม่: ' + entry.split('|').slice(1).join(' · '), nodeId: owner.id, parentId: owner.id });
	}
	return issues;
}
