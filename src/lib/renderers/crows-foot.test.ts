import { describe, it, expect } from 'vitest';
import { CrowsFootRenderer } from './crows-foot';
import type { Entity, CardinalityType } from '$lib/types/er';

function makeEntity(name: string, attrCount: number): Entity {
	return {
		id: 'test-id',
		name,
		attributes: Array.from({ length: attrCount }, (_, i) => ({
			id: `attr-${i}`,
			name: `attr_${i}`,
			type: 'regular' as const
		})),
		position: { x: 100, y: 200 },
		isWeak: false
	};
}

describe('CrowsFootRenderer', () => {
	const renderer = new CrowsFootRenderer();

	describe('getEntityRect', () => {
		it('returns minimum width for short names', () => {
			const entity = makeEntity('A', 0);
			const rect = renderer.getEntityRect(entity);
			expect(rect.width).toBe(160); // minWidth
		});

		it('returns wider rect for long entity names', () => {
			const entity = makeEntity('VeryLongEntityNameThatExceedsMinWidth', 0);
			const rect = renderer.getEntityRect(entity);
			expect(rect.width).toBeGreaterThan(160);
		});

		it('accounts for long attribute names', () => {
			const entity = makeEntity('Short', 1);
			entity.attributes[0].name = 'this_is_a_very_long_attribute_name_that_is_wide';
			const rect = renderer.getEntityRect(entity);
			expect(rect.width).toBeGreaterThan(160);
		});

		it('calculates height based on attribute count', () => {
			const entity0 = makeEntity('E', 0);
			const entity3 = makeEntity('E', 3);
			const entity10 = makeEntity('E', 10);

			const rect0 = renderer.getEntityRect(entity0);
			const rect3 = renderer.getEntityRect(entity3);
			const rect10 = renderer.getEntityRect(entity10);

			// Min 1 row even with 0 attributes
			expect(rect0.height).toBe(40 + 1 * 24 + 8);
			expect(rect3.height).toBe(40 + 3 * 24 + 8);
			expect(rect10.height).toBeGreaterThan(rect3.height);
		});

		it('uses entity position for x and y', () => {
			const entity = makeEntity('Test', 0);
			const rect = renderer.getEntityRect(entity);
			expect(rect.x).toBe(100);
			expect(rect.y).toBe(200);
		});
	});

	describe('formatCardinality', () => {
		const cases: [CardinalityType, string][] = [
			['1', '||'],
			['N', '|{'],
			['M', '|{'],
			['0..1', 'O|'],
			['0..N', 'O{'],
			['1..1', '||'],
			['1..N', '|{']
		];

		for (const [input, expected] of cases) {
			it(`maps '${input}' to '${expected}'`, () => {
				expect(renderer.formatCardinality(input)).toBe(expected);
			});
		}
	});
});
