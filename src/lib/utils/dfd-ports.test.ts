import { describe, expect, it } from 'vitest';
import { getDFDPorts } from './dfd-ports';
import type { DFDFlow, DFDNode } from '$lib/types/context-diagram';

const nodes: DFDNode[] = [
	{ id: 'p', name: 'System', type: 'process', processNumber: '0', position: { x: 300, y: 200 } },
	{ id: 'a', name: 'Customer', type: 'external-entity', position: { x: 30, y: 30 } },
	{ id: 'b', name: 'Supplier', type: 'external-entity', position: { x: 570, y: 30 } }
];
const flows: DFDFlow[] = [
	{ id: '1', label: 'Order', fromNodeId: 'a', toNodeId: 'p' },
	{ id: '2', label: 'Confirmation', fromNodeId: 'p', toNodeId: 'a' },
	{ id: '3', label: 'Shipment', fromNodeId: 'b', toNodeId: 'p' },
	{ id: '4', label: 'Request', fromNodeId: 'p', toNodeId: 'b' }
];

describe('DFD automatic ports', () => {
	it('keeps all connections facing their neighbour instead of filling unused sides', () => {
		const ports = getDFDPorts(nodes, flows);
		expect(ports.get('1')?.toSide).toBe('left');
		expect(ports.get('2')?.fromSide).toBe('left');
		expect(ports.get('3')?.toSide).toBe('right');
		expect(ports.get('4')?.fromSide).toBe('right');
	});
	it('separates reverse flows with consistent port order and independent lanes', () => {
		const ports = getDFDPorts(nodes, flows);
		expect(ports.get('1')!.from! < ports.get('2')!.to!).toBe(true);
		expect(ports.get('1')!.to! < ports.get('2')!.from!).toBe(true);
		expect(ports.get('1')!.routeOffset).not.toBe(ports.get('2')!.routeOffset);
		expect(getDFDPorts(nodes, [...flows].reverse())).toEqual(ports);
	});
	it('respects explicit sides and fits crowded ports inside small nodes', () => {
		const crowded = Array.from({ length: 8 }, (_, i) => ({ ...flows[0], id: String(i), toSide: 'top' as const }));
		const ports = getDFDPorts([{ ...nodes[0], width: 60 }, nodes[1]], crowded);
		for (const port of ports.values()) {
			expect(port.toSide).toBe('top');
			expect(Math.abs(port.to!)).toBeLessThanOrEqual(18);
		}
	});
});
