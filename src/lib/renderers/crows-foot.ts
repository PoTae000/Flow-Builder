import type { Entity, CardinalityType } from '$lib/types/er';
import type { Rect } from '$lib/types/geometry';
import type { NotationRenderer } from './types.ts';

export class CrowsFootRenderer implements NotationRenderer {
	headerHeight = 40;
	attributeRowHeight = 24;
	minWidth = 160;
	padding = 16;
	inlineAttributes = true;
	useDiamond = false;
	useOvalAttributes = false;
	showCardinalityText = false;
	useArrowMarkers = false;

	getEntityRect(entity: Entity): Rect {
		const charWidth = 8;
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
		// Crow's foot uses symbols, not text labels - this is for tooltip/fallback
		const map: Record<CardinalityType, string> = {
			'1': '||',
			'N': '|{',
			'M': '|{',
			'0..1': 'O|',
			'0..N': 'O{',
			'1..1': '||',
			'1..N': '|{'
		};
		return map[cardinality] ?? cardinality;
	}

	getMarkerDefs(): string {
		return '';
	}
}
