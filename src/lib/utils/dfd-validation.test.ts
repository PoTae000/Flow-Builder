import { describe, it, expect } from 'vitest';
import { validateDFD } from './dfd-validation';
import type { DFDNode, DFDFlow } from '$lib/types/context-diagram';
const node = (id: string, type: DFDNode['type'], extra: Partial<DFDNode> = {}): DFDNode => ({ id, name: id, type, position: { x: 0, y: 0 }, ...extra });
const flow = (id: string, fromNodeId: string, toNodeId: string, label: string, parentId?: string): DFDFlow => ({ id, fromNodeId, toNodeId, label, parentId });
const nodes = [node('system', 'process', { processNumber: '0' }), node('user', 'external-entity'), node('work', 'process', { processNumber: '1.0', parentId: 'system' }), node('ref', 'external-entity', { parentId: 'system', boundarySourceId: 'user' })];
const flows = [flow('in', 'user', 'system', 'Request'), flow('out', 'system', 'user', 'Result'), flow('child-in', 'ref', 'work', 'Request', 'system'), flow('child-out', 'work', 'ref', 'Result', 'system')];
describe('DFD validation', () => {
	it('accepts balanced Context and Level 1', () => expect(validateDFD(nodes, flows)).toEqual([]));
	it('detects a missing boundary input', () => expect(validateDFD(nodes, flows.filter(f => f.id !== 'child-in')).some(i => i.code === 'balance-missing')).toBe(true));
	it('detects changed labels and reversed boundary flows', () => {
		const changed = flows.map(f => f.id === 'child-in' ? { ...f, label: 'Other' } : f);
		expect(validateDFD(nodes, changed).filter(i => i.code.startsWith('balance-'))).toHaveLength(2);
		const reversed = flows.map(f => f.id === 'child-in' ? { ...f, fromNodeId: 'work', toNodeId: 'ref' } : f);
		expect(validateDFD(nodes, reversed).some(i => i.code === 'balance-extra')).toBe(true);
	});
	it('rejects context stores, duplicate numbers and flows without a process', () => {
		const extra = [node('store', 'data-store'), node('duplicate', 'process', { parentId: 'system', processNumber: '1.0' })];
		const issues = validateDFD([...nodes, ...extra], [...flows, flow('invalid', 'user', 'store', '')]);
		for (const code of ['context-store', 'duplicate-number', 'connection', 'flow-name', 'no-input', 'no-output']) expect(issues.some(i => i.code === code)).toBe(true);
	});
	it('detects invalid ancestors and cycles without hanging', () => {
		expect(validateDFD([node('cycle', 'process', { parentId: 'cycle' })], []).some(i => i.code === 'cycle')).toBe(true);
		expect(validateDFD([node('orphan', 'process', { parentId: 'missing' })], []).some(i => i.code === 'parent')).toBe(true);
	});
});
