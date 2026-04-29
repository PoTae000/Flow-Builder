import type { Entity, CardinalityType } from '$lib/types/er';
import type { Rect } from '$lib/types/geometry';
import type { NotationRenderer } from './types.ts';

export class UMLRenderer implements NotationRenderer {
	headerHeight = 44;
	attributeRowHeight = 22;
	minWidth = 180;
	padding = 12;
	inlineAttributes = true;
	useDiamond = false;
	useOvalAttributes = false;
	showCardinalityText = true;
	useArrowMarkers = false;

	getEntityRect(entity: Entity): Rect {
		const charWidth = 7.5;
		const nameWidth = entity.name.length * charWidth + this.padding * 2;
		const attrWidths = entity.attributes.map((a) => {
			const prefix = a.type === 'primary_key' ? '<<PK>> ' : a.type === 'foreign_key' ? '<<FK>> ' : '';
			return (prefix.length + a.name.length) * charWidth + this.padding * 2;
		});
		const maxAttrWidth = attrWidths.length > 0 ? Math.max(...attrWidths) : 0;
		const width = Math.max(this.minWidth, nameWidth, maxAttrWidth);
		const height =
			this.headerHeight +
			Math.max(entity.attributes.length, 1) * this.attributeRowHeight +
			8;

		return { x: entity.position.x, y: entity.position.y, width, height };
	}

	formatCardinality(cardinality: CardinalityType): string {
		const map: Record<CardinalityType, string> = {
			'1': '1',
			'N': '1..*',
			'M': '0..*',
			'0..1': '0..1',
			'0..N': '0..*',
			'1..1': '1..1',
			'1..N': '1..*'
		};
		return map[cardinality] ?? cardinality;
	}

	getMarkerDefs(): string {
		return '';
	}
}
