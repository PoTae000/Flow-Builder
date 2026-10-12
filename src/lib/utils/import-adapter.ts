import { NOTATION_OPTIONS, type NotationStyle } from '$lib/types/notation';
import type { Entity, Relationship, Attribute, AttributeType, CardinalityType } from '$lib/types/er';
import type { FlowNode, FlowEdge, FlowNodeType } from '$lib/types/flowchart';
import type { DFDNode, DFDFlow, DFDNodeType } from '$lib/types/context-diagram';
import type { ParsedResult, ParsedRelationship } from './sql-parser';
import { generateId } from './id';
import { computeFlowNodeSize } from './flow-node-size';

export interface ImportedDiagramData {
	notation?: NotationStyle;
	entities: Entity[];
	relationships: Relationship[];
	hasPositions?: boolean;
}

export function convertToDiagramData(parsed: ParsedResult): ImportedDiagramData {
	const entities: Entity[] = [];
	const relationships: Relationship[] = [];

	
	const nameToId = new Map<string, string>();

	
	for (const table of parsed.tables) {
		const entityId = generateId();
		nameToId.set(table.name.toLowerCase(), entityId);

		const attributes: Attribute[] = table.columns.map((col) => {
			let attrType: AttributeType = 'regular';
			if (col.isPrimaryKey) attrType = 'primary_key';
			else if (col.isForeignKey) attrType = 'foreign_key';

			return {
				id: generateId(),
				name: col.name,
				type: attrType
			};
		});

		entities.push({
			id: entityId,
			name: table.name,
			attributes,
			position: { x: 0, y: 0 }, // will be set by autoLayout
			isWeak: false
		});
	}

	
	const junctionTables = new Set<string>();
	const junctionPairs = new Map<string, ParsedRelationship[]>();

	for (const rel of parsed.relationships) {
		if (rel.isJunction) {
			const key = rel.fromTable.toLowerCase();
			junctionTables.add(key);
			if (!junctionPairs.has(key)) junctionPairs.set(key, []);
			junctionPairs.get(key)!.push(rel);
		}
	}

	
	const processedJunctions = new Set<string>();
	for (const [junctionName, rels] of junctionPairs) {
		if (rels.length >= 2 && !processedJunctions.has(junctionName)) {
			processedJunctions.add(junctionName);
			const entityA = nameToId.get(rels[0].toTable.toLowerCase());
			const entityB = nameToId.get(rels[1].toTable.toLowerCase());

			if (entityA && entityB) {
				
				const junctionTable = parsed.tables.find(
					(t) => t.name.toLowerCase() === junctionName
				);
				const relName = junctionTable?.name ?? 'has';

				relationships.push({
					id: generateId(),
					name: relName,
					entityIds: [entityA, entityB],
					cardinalities: ['N', 'M'] as [CardinalityType, CardinalityType],
					isIdentifying: false
				});
			}
		}
	}

	
	for (const rel of parsed.relationships) {
		if (rel.isJunction) continue;

		const fromId = nameToId.get(rel.fromTable.toLowerCase());
		const toId = nameToId.get(rel.toTable.toLowerCase());

		if (fromId && toId) {
			
			relationships.push({
				id: generateId(),
				name: rel.fromColumn.replace(/_id$/i, '').replace(/Id$/, '') || 'has',
				entityIds: [toId, fromId],
				cardinalities: ['1', 'N'] as [CardinalityType, CardinalityType],
				isIdentifying: false
			});
		}
	}

	return { entities, relationships };
}

export interface AiParsedData {
	notation?: string | null;
	entities: Array<{
		name: string;
		attributes: Array<{
			name: string;
			type: 'primary_key' | 'foreign_key' | 'regular' | 'partial_key' | 'derived' | 'multivalued' | 'composite';
		}>;
		isWeak?: boolean;
		position?: { x: number; y: number };
	}>;
	relationships: Array<{
		name: string;
		from: string;
		to: string;
		cardinalityFrom: string;
		cardinalityTo: string;
		isIdentifying?: boolean;
	}>;
}

export function convertAiDataToDiagram(data: AiParsedData): ImportedDiagramData {
	const entities: Entity[] = [];
	const relationships: Relationship[] = [];
	const nameToId = new Map<string, string>();

	
	const SCALE = 1.2;
	const OFFSET = 80;

	for (const e of data.entities) {
		const entityId = generateId();
		nameToId.set(e.name.toLowerCase(), entityId);

		const attributes: Attribute[] = (e.attributes || []).map((a) => ({
			id: generateId(),
			name: a.name,
			type: a.type as AttributeType
		}));

		entities.push({
			id: entityId,
			name: e.name,
			attributes,
			position: {
				x: (e.position?.x ?? 0) * SCALE + OFFSET,
				y: (e.position?.y ?? 0) * SCALE + OFFSET
			},
			isWeak: e.isWeak ?? false
		});
	}

	for (const r of data.relationships) {
		const fromId = nameToId.get(r.from.toLowerCase());
		const toId = nameToId.get(r.to.toLowerCase());

		if (fromId && toId) {
			relationships.push({
				id: generateId(),
				name: r.name,
				entityIds: [fromId, toId],
				cardinalities: [
					mapCardinality(r.cardinalityFrom),
					mapCardinality(r.cardinalityTo)
				],
				isIdentifying: r.isIdentifying ?? false
			});
		}
	}

	
	const hasPositions = data.entities.filter(e =>
		e.position && (e.position.x > 0 || e.position.y > 0)
	).length > data.entities.length / 2;

	const notation = NOTATION_OPTIONS.find(option => option.value === data.notation)?.value;
	return { entities, relationships, hasPositions, ...(notation ? { notation } : {}) };
}

function mapCardinality(value: string): CardinalityType {
	const v = value.trim().toUpperCase();
	const map: Record<string, CardinalityType> = {
		'1': '1',
		'N': 'N',
		'M': 'M',
		'0..1': '0..1',
		'0..N': '0..N',
		'1..1': '1..1',
		'1..N': '1..N',
		'MANY': 'N',
		'ONE': '1',
		'*': 'N',
		'0..*': '0..N',
		'1..*': '1..N'
	};
	return map[v] ?? '1';
}



export interface AiParsedFlowchart {
	flowNodes: Array<{
		name: string;
		type: FlowNodeType;
		position?: { x: number; y: number };
	}>;
	flowEdges: Array<{
		label?: string;
		fromNode: string;
		toNode: string;
		condition?: 'yes' | 'no';
	}>;
}

export interface ImportedFlowchartData {
	flowNodes: FlowNode[];
	flowEdges: FlowEdge[];
	hasPositions?: boolean;
}

export function convertAiFlowchartToDiagram(data: AiParsedFlowchart): ImportedFlowchartData {
	const flowNodes: FlowNode[] = [];
	const flowEdges: FlowEdge[] = [];
	const nameToId = new Map<string, string>();

	
	const SCALE = 1.3;
	const OFFSET = 100;

	
	for (const node of data.flowNodes) {
		const nodeId = generateId();
		nameToId.set(node.name.toLowerCase(), nodeId);

		const fn: FlowNode = {
			id: nodeId,
			name: node.name,
			type: node.type,
			position: {
				x: (node.position?.x ?? 0) * SCALE + OFFSET,
				y: (node.position?.y ?? 0) * SCALE + OFFSET
			}
		};
		
		const size = computeFlowNodeSize(fn);
		fn.width = size.width;
		fn.height = size.height;
		flowNodes.push(fn);
	}

	
	for (const edge of data.flowEdges) {
		const fromId = nameToId.get(edge.fromNode.toLowerCase());
		const toId = nameToId.get(edge.toNode.toLowerCase());

		if (fromId && toId) {
			flowEdges.push({
				id: generateId(),
				label: edge.label || '',
				fromNodeId: fromId,
				toNodeId: toId,
				condition: edge.condition
			});
		}
	}

	
	const hasPositions = data.flowNodes.filter(n =>
		n.position && (n.position.x > 0 || n.position.y > 0)
	).length > data.flowNodes.length / 2;

	return { flowNodes, flowEdges, hasPositions };
}



export interface AiParsedDFD {
	dfdNodes: Array<{
		name: string;
		type: DFDNodeType;
		processNumber?: string;
		storeNumber?: string;
		position?: { x: number; y: number };
	}>;
	dfdFlows: Array<{
		label: string;
		fromNode: string;
		toNode: string;
	}>;
}

export interface ImportedDFDData {
	dfdNodes: DFDNode[];
	dfdFlows: DFDFlow[];
	hasPositions?: boolean;
}

export function convertAiDFDToDiagram(data: AiParsedDFD): ImportedDFDData {
	const dfdNodes: DFDNode[] = [];
	const dfdFlows: DFDFlow[] = [];
	const nameToId = new Map<string, string>();

	
	const SCALE = 1.3;
	const OFFSET = 100;

	
	for (const node of data.dfdNodes) {
		const nodeId = generateId();
		nameToId.set(node.name.toLowerCase(), nodeId);

		dfdNodes.push({
			id: nodeId,
			name: node.name,
			type: node.type,
			position: {
				x: (node.position?.x ?? 0) * SCALE + OFFSET,
				y: (node.position?.y ?? 0) * SCALE + OFFSET
			},
			processNumber: node.processNumber,
			storeNumber: node.storeNumber
		});
	}

	
	for (const flow of data.dfdFlows) {
		const fromId = nameToId.get(flow.fromNode.toLowerCase());
		const toId = nameToId.get(flow.toNode.toLowerCase());

		if (fromId && toId) {
			dfdFlows.push({
				id: generateId(),
				label: flow.label,
				fromNodeId: fromId,
				toNodeId: toId
			});
		}
	}

	
	const hasPositions = data.dfdNodes.filter(n =>
		n.position && (n.position.x > 0 || n.position.y > 0)
	).length > data.dfdNodes.length / 2;

	return { dfdNodes, dfdFlows, hasPositions };
}
