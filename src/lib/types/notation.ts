export type NotationStyle = 'crows-foot' | 'chen' | 'uml' | 'min-max' | 'idef1x' | 'bachman' | 'barker' | 'arrow';

export interface NotationOption {
	value: NotationStyle;
	label: string;
	description: string;
}

export const NOTATION_OPTIONS: NotationOption[] = [
	{
		value: 'crows-foot',
		label: "Crow's Foot (IE)",
		description: 'Information Engineering - crow\'s foot symbols for cardinality'
	},
	{
		value: 'chen',
		label: 'Chen',
		description: 'Peter Chen - diamond relationships, oval attributes'
	},
	{
		value: 'uml',
		label: 'UML',
		description: 'Unified Modeling Language - class diagram style'
	},
	{
		value: 'min-max',
		label: 'Min-Max',
		description: 'Uses (min,max) pairs e.g. (0,N), (1,1)'
	},
	{
		value: 'idef1x',
		label: 'IDEF1X',
		description: 'US Federal standard - solid/dashed lines, dots for cardinality'
	},
	{
		value: 'bachman',
		label: 'Bachman',
		description: 'Charles Bachman - arrow-based network model notation'
	},
	{
		value: 'barker',
		label: 'Barker (Oracle)',
		description: 'Richard Barker - Oracle style, dashed=optional, solid=mandatory'
	},
	{
		value: 'arrow',
		label: 'Arrow',
		description: 'Simple arrow notation with text labels'
	}
];
