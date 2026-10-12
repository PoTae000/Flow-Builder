import type { DFDFlow, DFDNode, DFDSide } from '$lib/types/context-diagram';

export interface DFDPorts {
	from?: number;
	to?: number;
	fromSide?: DFDSide;
	toSide?: DFDSide;
	labelT?: number;
	labelSide?: 'left' | 'right';
	routeOffset?: number;
}

export function getDFDPorts(nodes: DFDNode[], flows: DFDFlow[]): Map<string, DFDPorts> {
	const byId = new Map(nodes.map(n => [n.id, n]));
	const result = new Map<string, DFDPorts>();
	const groups = new Map<string, { flow: DFDFlow; end: 'from' | 'to'; node: DFDNode; other: DFDNode; side: DFDSide }[]>();
	const pairs = new Map<string, DFDFlow[]>();
	const facing = (node: DFDNode, other: DFDNode): DFDSide => {
		const dx = other.position.x - node.position.x;
		const dy = other.position.y - node.position.y;
		if (node.type === 'data-store') return dy >= 0 ? 'bottom' : 'top';
		return Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
	};
	for (const flow of flows) {
		const from = byId.get(flow.fromNodeId), to = byId.get(flow.toNodeId);
		if (!from || !to) continue;
		const ports: DFDPorts = { fromSide: flow.fromSide ?? facing(from, to), toSide: flow.toSide ?? facing(to, from) };
		result.set(flow.id, ports);
		for (const end of ['from', 'to'] as const) {
			const node = end === 'from' ? from : to, other = end === 'from' ? to : from;
			const side = ports[end === 'from' ? 'fromSide' : 'toSide']!;
			const key = `${node.id}:${side}`;
			const members = groups.get(key) ?? [];
			members.push({ flow, end, node, other, side });
			groups.set(key, members);
		}
		const key = [from.id, to.id].sort().join('|');
		const members = pairs.get(key) ?? [];
		members.push(flow);
		pairs.set(key, members);
	}
	for (const members of groups.values()) {
		const horizontal = members[0].side === 'top' || members[0].side === 'bottom';
		members.sort((a, b) => (horizontal ? a.other.position.x - b.other.position.x : a.other.position.y - b.other.position.y) || a.flow.id.localeCompare(b.flow.id));
		const node = members[0].node;
		const length = horizontal ? (node.width ?? (node.type === 'external-entity' ? 120 : 140)) : (node.height ?? (node.type === 'process' ? (node.processNumber ? 78 : 50) : node.type === 'external-entity' ? 50 : 40));
		const spacing = Math.min(22, Math.max(0, length - 24) / Math.max(1, members.length - 1));
		members.forEach((member, i) => { result.get(member.flow.id)![member.end] = (i - (members.length - 1) / 2) * spacing; });
	}
	for (const members of pairs.values()) {
		members.sort((a, b) => a.id.localeCompare(b.id));
		members.forEach((flow, i) => {
			const ports = result.get(flow.id)!;
			ports.routeOffset = (i - (members.length - 1) / 2) * 24;
			ports.labelT = 0.5;
			ports.labelSide = 'left';
		});
	}
	return result;
}
