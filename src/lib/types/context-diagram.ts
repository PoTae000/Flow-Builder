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
	processNumber?: string;
	storeNumber?: string;
	position: Position;
	color?: string;
	width?: number;
	height?: number;




	parentId?: string;
	boundarySourceId?: string;
}

export type DFDSide = 'top' | 'right' | 'bottom' | 'left';

export interface DFDFlow {
	id: string;
	label: string;
	fromNodeId: string;
	toNodeId: string;
	fromSide?: DFDSide;
	toSide?: DFDSide;
	fromPortOffset?: number;
	toPortOffset?: number;
	waypoints?: Position[];
	labelPosition?: Position;


	parentId?: string;
	boundaryFlowId?: string;
}
