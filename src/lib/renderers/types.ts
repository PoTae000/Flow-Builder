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
	/** Compute the bounding rect for an entity */
	getEntityRect(entity: Entity): Rect;

	/** Format a cardinality label for display */
	formatCardinality(cardinality: CardinalityType): string;

	/** Get SVG marker IDs needed for this notation */
	getMarkerDefs(): string;

	/** Whether this notation renders attributes inside the entity box */
	inlineAttributes: boolean;

	/** Whether this notation uses a diamond shape for relationships */
	useDiamond: boolean;

	/** Whether this notation uses oval shapes for attributes */
	useOvalAttributes: boolean;

	/** Whether this notation shows cardinality as text labels on the line */
	showCardinalityText: boolean;

	/** Whether this notation uses arrow markers on lines */
	useArrowMarkers: boolean;

	/** Entity header height */
	headerHeight: number;

	/** Attribute row height */
	attributeRowHeight: number;

	/** Entity min width */
	minWidth: number;

	/** Entity padding */
	padding: number;
}
