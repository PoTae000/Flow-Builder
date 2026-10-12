import type { AttributeType } from './er';
import type { FlowNodeType } from './flowchart';
import type { DFDNodeType } from './context-diagram';

export interface AttrSpec {
	name: string;
	type: AttributeType;
}

export interface RelSpec {
	name: string;
	from: string;
	to: string;
	cardFrom: string;
	cardTo: string;
	isIdentifying?: boolean;
}

export type AgentAction =
	| { op: 'add-entity'; name: string; attributes: AttrSpec[]; isWeak?: boolean }
	| { op: 'remove-entity'; name: string }
	| { op: 'rename-entity'; name: string; newName: string }
	| { op: 'add-attribute'; entityName: string; attribute: AttrSpec }
	| { op: 'remove-attribute'; entityName: string; attributeName: string }
	| { op: 'add-relationship'; name: string; from: string; to: string; cardFrom: string; cardTo: string; isIdentifying?: boolean }
	| { op: 'remove-relationship'; name: string }
	| { op: 'modify-relationship'; name: string; updates: Partial<RelSpec> }
	| { op: 'add-flow-node'; name: string; type: FlowNodeType }
	| { op: 'remove-flow-node'; name: string }
	| { op: 'add-flow-edge'; label: string; fromNode: string; toNode: string; condition?: 'yes' | 'no' }
	| { op: 'remove-flow-edge'; fromNode: string; toNode: string }
	| { op: 'add-dfd-node'; name: string; type: DFDNodeType; processNumber?: string; storeNumber?: string }
	| { op: 'remove-dfd-node'; name: string }
	| { op: 'add-dfd-flow'; label: string; fromNode: string; toNode: string }
	| { op: 'remove-dfd-flow'; fromNode: string; toNode: string }
	| { op: 'auto-layout' };

export type AgentStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface AgentStep {
	id: string;
	label: string;
	status: AgentStepStatus;
	actions?: AgentAction[];
	error?: string;
}

export interface AutoCompleteSuggestion {
	id: string;
	label: string;
	description: string;
	actions: AgentAction[];
}
