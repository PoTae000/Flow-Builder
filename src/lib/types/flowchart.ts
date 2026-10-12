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
	| 'internal-storage'
	| 'manual-input'
	| 'off-page-connector'
	| 'merge'
	| 'extract'
	| 'or'
	| 'summing-junction'
	| 'stored-data'
	// General shapes
	| 'ellipse'
	| 'circle'
	| 'square'
	| 'triangle'
	| 'trapezoid'
	| 'cloud'
	| 'callout'
	| 'card'
	| 'step'
	| 'star'
	| 'cross'
	| 'tape'
	// Arrows
	| 'arrow-right'
	| 'arrow-left'
	| 'arrow-up'
	| 'arrow-down'
	| 'arrow-bidirectional'
	// UML
	| 'uml-class'
	| 'uml-actor'
	| 'uml-note'
	| 'uml-package'
	| 'uml-component';

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
	{ value: 'internal-storage', label: 'Internal Storage' },
	{ value: 'manual-input', label: 'Manual Input' },
	{ value: 'off-page-connector', label: 'Off-page Connector' },
	{ value: 'merge', label: 'Merge' },
	{ value: 'extract', label: 'Extract' },
	{ value: 'or', label: 'Or' },
	{ value: 'summing-junction', label: 'Summing Junction' },
	{ value: 'stored-data', label: 'Stored Data' },
	{ value: 'ellipse', label: 'Ellipse' },
	{ value: 'circle', label: 'Circle' },
	{ value: 'square', label: 'Square' },
	{ value: 'triangle', label: 'Triangle' },
	{ value: 'trapezoid', label: 'Trapezoid' },
	{ value: 'cloud', label: 'Cloud' },
	{ value: 'callout', label: 'Callout' },
	{ value: 'card', label: 'Card' },
	{ value: 'step', label: 'Step' },
	{ value: 'star', label: 'Star' },
	{ value: 'cross', label: 'Cross' },
	{ value: 'tape', label: 'Tape' },
	{ value: 'arrow-right', label: 'Arrow Right' },
	{ value: 'arrow-left', label: 'Arrow Left' },
	{ value: 'arrow-up', label: 'Arrow Up' },
	{ value: 'arrow-down', label: 'Arrow Down' },
	{ value: 'arrow-bidirectional', label: 'Arrow Bi-directional' },
	{ value: 'uml-class', label: 'UML Class' },
	{ value: 'uml-actor', label: 'UML Actor' },
	{ value: 'uml-note', label: 'UML Note' },
	{ value: 'uml-package', label: 'UML Package' },
	{ value: 'uml-component', label: 'UML Component' }
];

export interface FlowNode {
	id: string;
	name: string;
	type: FlowNodeType;
	position: Position;
	color?: string;
	borderRadius?: number;
	width?: number;
	height?: number;
	manualSize?: boolean;
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;





	wordOffsets?: Record<number, { x: number; y: number }>;
}

export type LineStyle = 'orthogonal' | 'straight' | 'curved';
export type StrokeDash = 'solid' | 'dashed' | 'dotted';

export interface FlowEdge {
	id: string;
	label: string;
	fromNodeId: string;
	toNodeId: string;
	condition?: 'yes' | 'no';
	labelOffset?: Position;
	fromSide?: 'top' | 'right' | 'bottom' | 'left';
	toSide?: 'top' | 'right' | 'bottom' | 'left';
	waypoints?: Position[];
	lineStyle?: LineStyle;
	routingMode?: 'auto' | 'horizontal' | 'vertical' | 'elbow' | 'step';
	strokeWidth?: number;
	strokeDash?: StrokeDash;
	edgeColor?: string;
	startArrow?: 'filled' | 'open' | 'diamond' | 'none';
	endArrow?: 'filled' | 'open' | 'diamond' | 'none';
	arrowHead?: 'filled' | 'open' | 'diamond' | 'none';
	arrowDirection?: 'end' | 'start' | 'both';
}
