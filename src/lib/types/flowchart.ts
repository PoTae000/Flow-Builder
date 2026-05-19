import type { Position } from './geometry';

export type FlowNodeType =
	| 'start-end'
	| 'process'
	| 'decision'
	| 'input-output'
	| 'connector'
	| 'document'
	| 'database'
	| 'predefined-process'
	| 'manual-operation'
	| 'preparation'
	| 'delay'
	| 'display'
	| 'internal-storage';

export const FLOW_NODE_TYPE_OPTIONS: { value: FlowNodeType; label: string }[] = [
	{ value: 'start-end', label: 'Start/End' },
	{ value: 'process', label: 'Process' },
	{ value: 'decision', label: 'Decision' },
	{ value: 'input-output', label: 'Input/Output' },
	{ value: 'connector', label: 'Connector' },
	{ value: 'document', label: 'Document' },
	{ value: 'database', label: 'Database' },
	{ value: 'predefined-process', label: 'Predefined Process' },
	{ value: 'manual-operation', label: 'Manual Operation' },
	{ value: 'preparation', label: 'Preparation' },
	{ value: 'delay', label: 'Delay' },
	{ value: 'display', label: 'Display' },
	{ value: 'internal-storage', label: 'Internal Storage' }
];

export interface FlowNode {
	id: string;
	name: string;
	type: FlowNodeType;
	position: Position;
	color?: string;
	borderRadius?: number; // For start-end nodes (0-50, default 20)
	width?: number; // Default 140
	height?: number; // Default 60
}

export type LineStyle = 'orthogonal' | 'straight' | 'curved';
export type StrokeDash = 'solid' | 'dashed' | 'dotted';

export interface FlowEdge {
	id: string;
	label: string;
	fromNodeId: string;
	toNodeId: string;
	condition?: 'yes' | 'no';
	waypoints?: Position[]; // Manual bend points
	lineStyle?: LineStyle; // Default 'orthogonal'
	strokeWidth?: number; // Default 1.5
	strokeDash?: StrokeDash; // Default 'solid'
	edgeColor?: string; // Custom color
}
