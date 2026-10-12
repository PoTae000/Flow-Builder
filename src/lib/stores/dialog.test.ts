import { describe, expect, it } from 'vitest';
import { dialog } from './dialog.svelte';

describe('save before deletion choices', () => {
	it.each([
		[true, 'save'], ['secondary', 'discard'], [false, 'cancel']
	] as const)('returns the selected action for %s', async (action, expected) => {
		const result = dialog.choose({ title: 'Save?', message: 'Save before deleting?', secondaryText: 'Delete' });
		dialog.close(action);
		expect(await result).toBe(expected);
		expect(dialog.current).toBeNull();
	});
	it('keeps ordinary confirmation results boolean', async () => {
		const result = dialog.confirm({ title: 'Delete?', message: 'Confirm deletion' });
		dialog.close(false);
		expect(await result).toBe(false);
	});
});
