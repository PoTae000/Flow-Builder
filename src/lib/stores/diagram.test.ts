import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramState, registerCollab } from './diagram.svelte';
vi.mock('$lib/utils/elk-layout', () => ({ computeFlowELKLayout: async () => new Map() }));

describe('DFD boundaries and editing ownership', () => {
	let state: DiagramState;
	beforeEach(() => { vi.useFakeTimers(); state = new DiagramState(); });
	afterEach(() => { registerCollab(null); vi.clearAllTimers(); vi.useRealTimers(); });
	it('preserves manually moved ER segments through undo and redo', () => {
		state.relationships = [{ id: 'rel', name: 'has', entityIds: ['a', 'b'], cardinalities: ['1', 'N'], isIdentifying: false }];
		const waypoints = [{ x: 200, y: 20 }, { x: 200, y: 120 }];
		state.updateRelationship('rel', { waypoints });
		expect(state.relationships[0].waypoints).toEqual(waypoints);
		state.undo();
		expect(state.relationships[0].waypoints).toBeUndefined();
		state.redo();
		expect(state.relationships[0].waypoints).toEqual(waypoints);
	});
	it('stores a moved Chen diamond and restores its position with undo/redo', () => {
		state.relationships = [{ id: 'chen', name: 'Purchase', entityIds: ['a', 'b'], cardinalities: ['1', 'N'], isIdentifying: false }];
		state.updateRelationship('chen', { diamondPosition: { x: 400, y: 300 }, fromWaypoints: [], toWaypoints: [] });
		expect(state.relationships[0].diamondPosition).toEqual({ x: 400, y: 300 });
		state.undo();
		expect(state.relationships[0].diamondPosition).toBeUndefined();
		state.redo();
		expect(state.relationships[0].diamondPosition).toEqual({ x: 400, y: 300 });
	});
	it('opens Levels 1 and 2 and refuses Level 3', () => {
		state.diagramType = 'context';
		const root = state.addDFDNode('System', 'process')!;
		state.drillIntoDFDNode(root.id);
		const child = state.addDFDNode('Child', 'process')!;
		state.drillIntoDFDNode(child.id);
		const grandchild = state.addDFDNode('Grandchild', 'process')!;
		state.drillIntoDFDNode(grandchild.id);
		expect(state.dfdDrillPath).toEqual([root.id, child.id]);
		expect(state.dfdNodes.some(n => n.parentId === grandchild.id)).toBe(false);
	});
	it('cannot drill into a node from another level', () => {
		const first = state.addDFDNode('First', 'process')!;
		const second = state.addDFDNode('Second', 'external-entity')!;
		state.drillIntoDFDNode(first.id);
		state.drillIntoDFDNode(second.id);
		expect(state.dfdDrillPath).toEqual([first.id]);
	});
	it('rejects cross-level flows and direct entity-to-store flows', () => {
		const process = state.addDFDNode('Process', 'process')!;
		const entity = state.addDFDNode('User', 'external-entity')!;
		const store = { id: 'legacy-store', name: 'Data', type: 'data-store' as const, position: { x: 0, y: 0 } };
		state.dfdNodes.push(store);
		expect(state.addDFDFlow('invalid', entity.id, store.id)).toBeNull();
		expect(state.addDFDFlow('valid', entity.id, process.id)).not.toBeNull();
		state.drillIntoDFDNode(process.id);
		const child = state.addDFDNode('Child', 'process')!;
		expect(state.addDFDFlow('cross-level', child.id, entity.id)).toBeNull();
	});
	it('preserves a locked entity, its attributes and connections', () => {
		const entity = state.addEntity('Original');
		const other = state.addEntity('Other');
		state.addAttribute(entity.id, { name: 'id', type: 'primary_key' });
		state.addRelationship('Link', [entity.id, other.id], ['1', 'N']);
		const runLocked = vi.fn();
		registerCollab({ connected: true, isViewer: false, canEdit: () => false, runLocked } as unknown as Parameters<typeof registerCollab>[0]);
		state.updateEntity(entity.id, { name: 'Overwrite' });
		state.removeAttribute(entity.id, entity.attributes[0].id);
		state.moveEntity(entity.id, { x: 999, y: 999 });
		state.removeEntity(entity.id);
		expect(entity.name).toBe('Original');
		expect(entity.attributes).toHaveLength(1);
		expect(entity.position).not.toEqual({ x: 999, y: 999 });
		expect(state.entities).toHaveLength(2);
		expect(state.relationships).toHaveLength(1);
		expect(runLocked.mock.calls.at(-1)?.[0]).toContain(state.relationships[0].id);
	});
	it('replaces one DFD level without changing its siblings or descendants', async () => {
		const root = state.addDFDNode('System', 'process')!;
		const sibling = state.addDFDNode('Outside', 'external-entity')!;
		state.drillIntoDFDNode(root.id);
		const child = state.addDFDNode('Child', 'process')!;
		state.drillIntoDFDNode(child.id);
		const grandchild = state.addDFDNode('Grandchild', 'process')!;
		state.drillUpDFD();
		await state.replaceDFDLevel([{ ...child, id: 'generated-id' }], [], 'AI fix', false);
		expect(state.dfdNodes.find(n => n.id === child.id)?.parentId).toBe(root.id);
		expect(state.dfdNodes.find(n => n.id === sibling.id)).toEqual(sibling);
		expect(state.dfdNodes.find(n => n.id === grandchild.id)?.parentId).toBe(child.id);
	});
	it('preserves independent cardinality positions through undo and redo', () => {
		const first = state.addEntity('First');
		const second = state.addEntity('Second');
		state.addRelationship('Link', [first.id, second.id], ['1', 'N']);
		const id = state.relationships[0].id;
		state.updateRelationship(id, { fromCardinalityOffset: { x: 30, y: -10 } });
		state.updateRelationship(id, { toCardinalityOffset: { x: -20, y: 15 } });
		expect(state.relationships[0].fromCardinalityOffset).toEqual({ x: 30, y: -10 });
		expect(state.relationships[0].toCardinalityOffset).toEqual({ x: -20, y: 15 });
		state.undo();
		expect(state.relationships[0].fromCardinalityOffset).toEqual({ x: 30, y: -10 });
		expect(state.relationships[0].toCardinalityOffset).toBeUndefined();
		state.redo();
		expect(state.relationships[0].toCardinalityOffset).toEqual({ x: -20, y: 15 });
	});
	it('finishes a Flowchart layout before releasing editing leases', async () => {
		state.diagramType = 'flowchart';
		state.addFlowNode('Start', 'start-end');
		vi.spyOn(state as any, '_startFlowAnimation').mockImplementation(() => {});
		state.flowAutoLayout();
		const completion = state.waitForEdits();
		await vi.runAllTimersAsync();
		await expect(completion).resolves.toBeUndefined();
	});
});
