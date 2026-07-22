import type { Entity, Relationship, CardinalityType } from '$lib/types/er';
import type { Rect } from '$lib/types/geometry';
import type { NotationRenderer } from './types.ts';

export class BarkerRenderer implements NotationRenderer {
	headerHeight = 40;
	attributeRowHeight = 22;
	minWidth = 160;
	padding = 14;
	inlineAttributes = true;
	useDiamond = false;
	useOvalAttributes = false;
	showCardinalityText = true;
	useArrowMarkers = false;

	getEntityRect(entity: Entity): Rect {
		const charWidth = 7.5;
		const nameWidth = entity.name.length * charWidth + this.padding * 2;
		const attrWidths = entity.attributes.map(
			(a) => a.name.length * charWidth + this.padding * 2 + 20
		);
		const maxAttrWidth = attrWidths.length > 0 ? Math.max(...attrWidths) : 0;
		const width = Math.max(this.minWidth, nameWidth, maxAttrWidth);
		const height =
			this.headerHeight +
			Math.max(entity.attributes.length, 1) * this.attributeRowHeight +
			8;

		return { x: entity.position.x, y: entity.position.y, width, height };
	}

	formatCardinality(cardinality: CardinalityType): string {
		// Barker uses line styles: solid = mandatory, dashed = optional
		// Text labels shown as fallback
		const map: Record<CardinalityType, string> = {
			'1': 'one',
			'N': 'many',
			'M': 'many',
			'0..1': 'one?',
			'0..N': 'many?',
			'1..1': 'one',
			'1..N': 'many'
		};
		return map[cardinality] ?? cardinality;
	}

	getStrokeDashArray(relationship: Relationship): string | undefined {
		return relationship.isIdentifying ? undefined : '8 4';
	}

	getMarkerDefs(): string {
		return '';
	}
}
