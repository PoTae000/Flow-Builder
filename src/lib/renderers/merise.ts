import type { Entity, Relationship, CardinalityType } from '$lib/types/er';
import type { Rect } from '$lib/types/geometry';
import type { NotationRenderer } from './types.ts';

export class MeriseRenderer implements NotationRenderer {
	headerHeight = 40;
	attributeRowHeight = 24;
	minWidth = 160;
	padding = 16;
	inlineAttributes = true;
	useDiamond = false;
	useOvalAttributes = false;
	showCardinalityText = true;
	useArrowMarkers = false;
	useOvalRelationshipLabel = true;

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
		const map: Record<CardinalityType, string> = {
			'1': '1,1',
			'N': '1,N',
			'M': '0,N',
			'0..1': '0,1',
			'0..N': '0,N',
			'1..1': '1,1',
			'1..N': '1,N'
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
