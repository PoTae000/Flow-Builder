import { describe, expect, it } from 'vitest';
import { validateActions, validateScopedResponse } from './ai-scope';

describe('AI diagram scope', () => {
	it('rejects a whole mixed batch instead of applying part of it', () => {
		expect(validateActions([{ op: 'add-flow-node', name: 'Start', type: 'start-end' }, { op: 'add-entity', name: 'User', attributes: [] }], 'flowchart')).toBe(false);
	});
	it('rejects malformed operations before they reach the editor', () => {
		expect(validateActions([{ op: 'remove-entity' }], 'er')).toBe(false);
		expect(validateActions([{ op: 'add-dfd-node', name: 'Decision', type: 'decision' }], 'context')).toBe(false);
	});
	it('accepts a scoped DFD batch', () => {
		expect(validateActions([{ op: 'add-dfd-node', name: 'Process', type: 'process' }, { op: 'auto-layout' }], 'context')).toBe(true);
	});
	it('rejects cross-type generated structures and suggestions', () => {
		expect(validateScopedResponse({ entities: [{ name: 'User' }] }, 'context')).toBe(false);
		expect(validateScopedResponse({ suggestions: [{ actions: [{ op: 'remove-flow-node', name: 'Start' }] }] }, 'er')).toBe(false);
	});
	it('rejects DFD output that connects an external entity directly to a store', () => {
		expect(validateScopedResponse({ dfdNodes: [{ name: 'User', type: 'external-entity' }, { name: 'Data', type: 'data-store' }], dfdFlows: [{ fromNode: 'User', toNode: 'Data', label: 'Invalid' }] }, 'context')).toBe(false);
	});
});
