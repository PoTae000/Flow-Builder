import { describe, expect, it } from 'vitest';
import { NOTATION_OPTIONS } from '$lib/types/notation';
import { convertAiDataToDiagram } from './import-adapter';

describe('ER image notation', () => {
	for (const { value } of NOTATION_OPTIONS) {
		it(`preserves ${value} through conversion`, () => {
			const result = convertAiDataToDiagram({
				notation: value,
				entities: [{ name: 'ลูกค้า', attributes: [], position: { x: 100, y: 200 } }],
				relationships: []
			});
			expect(result.notation).toBe(value);
			expect(result.entities[0].name).toBe('ลูกค้า');
			expect(result.hasPositions).toBe(true);
		});
	}
	it('leaves the current notation unchanged when detection is uncertain or invalid', () => {
		for (const notation of [undefined, null, 'unknown']) {
			expect(convertAiDataToDiagram({ notation, entities: [], relationships: [] }).notation).toBeUndefined();
		}
	});
});
