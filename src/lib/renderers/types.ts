import type { Entity, Relationship, CardinalityType } from '$lib/types/er';
import type { Rect, ConnectionPoint } from '$lib/types/geometry';

export interface EntityRenderData {
	entity: Entity;
	rect: Rect;
}

export interface RelationshipRenderData {
	relationship: Relationship;
	fromEntity: EntityRenderData;
	toEntity: EntityRenderData;
	fromPoint: ConnectionPoint;
	toPoint: ConnectionPoint;
}

export interface NotationRenderer {
	
	getEntityRect(entity: Entity): Rect;

	
	formatCardinality(cardinality: CardinalityType): string;

	
	getMarkerDefs(): string;

	
	getStrokeDashArray(relationship: Relationship): string | undefined;

	
	inlineAttributes: boolean;

	
	useDiamond: boolean;

	
	useOvalAttributes: boolean;

	
	showCardinalityText: boolean;

	
	useArrowMarkers: boolean;

	
	headerHeight: number;

	
	attributeRowHeight: number;

	
	minWidth: number;

	
	padding: number;

	
	useOvalRelationshipLabel?: boolean;
}
