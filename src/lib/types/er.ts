import type { ERAnchor } from '$lib/utils/er-ports';
import type { Position } from './geometry.ts';

export type AttributeType = 'regular' | 'primary_key' | 'foreign_key' | 'partial_key' | 'derived' | 'multivalued' | 'composite';

export interface Attribute {
	sqlType?: string;
	sqlReferences?: { table: string; column: string };
	id: string;
	name: string;
	type: AttributeType;

	position?: Position;
}

export type CardinalityType = '1' | 'N' | 'M' | '0..1' | '0..N' | '1..1' | '1..N';

export interface Entity {
	id: string;
	name: string;
	attributes: Attribute[];
	position: Position;
	isWeak: boolean;
	color?: string;
	isLocked?: boolean;
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;

	sampleRows?: SampleRow[];
}

export type SampleCell = string | number | null;
export type SampleRow = Record<string, SampleCell>;

export interface Relationship {
	fromCardinalityOffset?: Position;
	toCardinalityOffset?: Position;
	fromAnchor?: ERAnchor;
	toAnchor?: ERAnchor;
	diamondPosition?: Position;
	waypoints?: Position[];
	fromWaypoints?: Position[];
	toWaypoints?: Position[];
	id: string;
	name: string;
	entityIds: [string, string];
	cardinalities: [CardinalityType, CardinalityType];
	isIdentifying: boolean;
	description?: string;
	labelOffset?: Position;
	dataFlowDirection?: 'none' | 'forward' | 'reverse' | 'both';
}

export type NoteColor = 'yellow' | 'blue' | 'green' | 'red' | 'purple';

export interface Note {
	id: string;
	text: string;
	position: Position;
	color?: NoteColor;
}
