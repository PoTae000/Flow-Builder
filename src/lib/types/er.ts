import type { Position } from './geometry.ts';

export type AttributeType = 'regular' | 'primary_key' | 'foreign_key' | 'partial_key' | 'derived' | 'multivalued' | 'composite';

export interface Attribute {
	id: string;
	name: string;
	type: AttributeType;
	/** Custom position for Chen notation (optional, used when user drags the oval) */
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
}

export interface Relationship {
	id: string;
	name: string;
	entityIds: [string, string];
	cardinalities: [CardinalityType, CardinalityType];
	isIdentifying: boolean;
	description?: string;
}

export type NoteColor = 'yellow' | 'blue' | 'green' | 'red' | 'purple';

export interface Note {
	id: string;
	text: string;
	position: Position;
	color?: NoteColor;
}
