export interface ThemeColors {
	entityFill: string;
	entityStroke: string;
	entityHeaderFill: string;
	entityHeaderText: string;
	entityText: string;
	weakEntityStroke: string;
	pkColor: string;
	fkColor: string;
	attrText: string;
	relationshipStroke: string;
	relationshipFill: string;
	relationshipText: string;
	cardinalityText: string;
	chenDiamondFill: string;
	chenDiamondStroke: string;
	chenOvalFill: string;
	chenOvalStroke: string;
	selectedStroke: string;
	selectedGlow: string;
	canvasBg: string;
	gridColor: string;
	gridColorDark: string;
}

export const DARK_COLORS: ThemeColors = {
	// Entity
	entityFill: '#1e1e1e',
	entityStroke: '#555555',
	entityHeaderFill: '#2a2a2a',
	entityHeaderText: '#e0e0e0',
	entityText: '#cccccc',
	weakEntityStroke: '#555555',

	// Attribute
	pkColor: '#f59e0b',
	fkColor: '#a78bfa',
	attrText: '#999999',

	// Relationship
	relationshipStroke: '#666666',
	relationshipFill: '#2a2a2a',
	relationshipText: '#e0e0e0',
	cardinalityText: '#ef4444',

	// Chen notation
	chenDiamondFill: '#2a2a2a',
	chenDiamondStroke: '#666666',
	chenOvalFill: '#2a2a2a',
	chenOvalStroke: '#666666',

	// Selection
	selectedStroke: '#60a5fa',
	selectedGlow: '#60a5fa40',

	// Canvas
	canvasBg: '#141414',
	gridColor: '#1e1e1e',
	gridColorDark: '#2a2a2a'
} as const;

export const LIGHT_COLORS: ThemeColors = {
	// Entity
	entityFill: '#ffffff',
	entityStroke: '#333333',
	entityHeaderFill: '#f5f5f5',
	entityHeaderText: '#1a1a1a',
	entityText: '#333333',
	weakEntityStroke: '#666666',

	// Attribute
	pkColor: '#d97706',
	fkColor: '#7c3aed',
	attrText: '#555555',

	// Relationship
	relationshipStroke: '#444444',
	relationshipFill: '#ffffff',
	relationshipText: '#1a1a1a',
	cardinalityText: '#dc2626',

	// Chen notation
	chenDiamondFill: '#ffffff',
	chenDiamondStroke: '#444444',
	chenOvalFill: '#ffffff',
	chenOvalStroke: '#444444',

	// Selection
	selectedStroke: '#3b82f6',
	selectedGlow: '#3b82f640',

	// Canvas
	canvasBg: '#fafafa',
	gridColor: '#e5e5e5',
	gridColorDark: '#d4d4d4'
} as const;

// Legacy export for backward compat - will be removed
export const COLORS = DARK_COLORS;
