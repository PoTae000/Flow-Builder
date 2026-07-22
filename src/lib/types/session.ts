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
	pinned?: boolean;
	tags?: string[];
}

export interface ViewBookmark {
	slot: number;
	panX: number;
	panY: number;
	zoom: number;
}

export interface CustomFont {
	label: string;
	value: string;
	url: string;
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
	customFonts?: CustomFont[];
}

export interface VersionMeta {
	id: number;
	createdAt: number;
	name: string;
	diagramType: string;
}

export type PlanType = 'basic' | 'advanced';

export interface UserProfile {
	sub: string;
	name: string;
	email: string;
	picture: string;
	plan: PlanType;
	planExpiresAt?: string | null;
	isAdmin?: boolean;
}
