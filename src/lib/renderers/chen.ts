import type { Entity, CardinalityType } from '$lib/types/er';
import type { Rect } from '$lib/types/geometry';
import type { NotationRenderer } from './types.ts';

export class ChenRenderer implements NotationRenderer {
	headerHeight = 40;
	attributeRowHeight = 24;
	minWidth = 120;
	padding = 16;
	inlineAttributes = false;
	useDiamond = true;
	useOvalAttributes = true;
	showCardinalityText = true;
	useArrowMarkers = false;

	getEntityRect(entity: Entity): Rect {
		const charWidth = 9;
		const nameWidth = entity.name.length * charWidth + this.padding * 2;
		const width = Math.max(this.minWidth, nameWidth);
		const height = this.headerHeight + 8;

		return { x: entity.position.x, y: entity.position.y, width, height };
	}

	formatCardinality(cardinality: CardinalityType): string {
		const map: Record<CardinalityType, string> = {
			'1': '1',
			'N': 'N',
			'M': 'M',
			'0..1': '0..1',
			'0..N': '0..N',
			'1..1': '1',
			'1..N': '1..N'
		};
		return map[cardinality] ?? cardinality;
	}

	getMarkerDefs(): string {
		return '';
	}
}
