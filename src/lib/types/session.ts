import type { Entity, Relationship, Note } from './er';
import type { NotationStyle } from './notation';
import type { DiagramType } from './diagram';
import type { FlowNode, FlowEdge } from './flowchart';
import type { DFDNode, DFDFlow } from './context-diagram';

export interface DiagramMeta {
	id: string;
	name: string;
	diagramType?: DiagramType;
	createdAt: number;
	updatedAt: number;
}

export interface ViewBookmark {
	slot: number;
	panX: number;
	panY: number;
	zoom: number;
}

export interface DiagramData {
	entities: Entity[];
	relationships: Relationship[];
	notes?: Note[];
	notation: NotationStyle;
	diagramFont: string;
	panX: number;
	panY: number;
	zoom: number;
	diagramType?: DiagramType;
	flowNodes?: FlowNode[];
	flowEdges?: FlowEdge[];
	dfdNodes?: DFDNode[];
	dfdFlows?: DFDFlow[];
	bookmarks?: ViewBookmark[];
}

export interface UserProfile {
	sub: string;
	name: string;
	email: string;
	picture: string;
}
