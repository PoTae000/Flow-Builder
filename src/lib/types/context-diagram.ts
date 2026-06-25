import type { Position } from './geometry';

export type DFDNodeType = 'process' | 'external-entity' | 'data-store';

export const DFD_NODE_TYPE_OPTIONS: { value: DFDNodeType; label: string }[] = [
	{ value: 'process', label: 'Process' },
	{ value: 'external-entity', label: 'External Entity' },
	{ value: 'data-store', label: 'Data Store' }
];

export interface DFDNode {
	id: string;
	name: string;
	type: DFDNodeType;
	processNumber?: string; // "1.0", "2.0"
	storeNumber?: string; // "D1", "D2"
	position: Position;
	color?: string;
}

export type DFDSide = 'top' | 'right' | 'bottom' | 'left';

export interface DFDFlow {
	id: string;
	label: string;
	fromNodeId: string;
	toNodeId: string;
	fromSide?: DFDSide;
	toSide?: DFDSide;
	fromPortOffset?: number; // offset from center along the side edge
	toPortOffset?: number;
	waypoints?: Position[];
	labelPosition?: Position; // user-placed label position (SVG coords)
}
