import type { Entity, Relationship, Attribute, AttributeType, CardinalityType } from '$lib/types/er';
import type { FlowNode, FlowEdge, FlowNodeType } from '$lib/types/flowchart';
import type { DFDNode, DFDFlow, DFDNodeType } from '$lib/types/context-diagram';
import type { ParsedResult, ParsedRelationship } from './sql-parser';
import { generateId } from './id';

export interface ImportedDiagramData {
	entities: Entity[];
	relationships: Relationship[];
	hasPositions?: boolean;
}

export function convertToDiagramData(parsed: ParsedResult): ImportedDiagramData {
	const entities: Entity[] = [];
	const relationships: Relationship[] = [];

	// Map table name → entity ID
	const nameToId = new Map<string, string>();

	// Create entities from tables
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

	// Detect junction tables for M:N
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

	// Create M:N relationships from junction tables
	const processedJunctions = new Set<string>();
	for (const [junctionName, rels] of junctionPairs) {
		if (rels.length >= 2 && !processedJunctions.has(junctionName)) {
			processedJunctions.add(junctionName);
			const entityA = nameToId.get(rels[0].toTable.toLowerCase());
			const entityB = nameToId.get(rels[1].toTable.toLowerCase());

			if (entityA && entityB) {
				// Build relationship name from junction table name
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

	// Create 1:N relationships from non-junction FKs
	for (const rel of parsed.relationships) {
		if (rel.isJunction) continue;

		const fromId = nameToId.get(rel.fromTable.toLowerCase());
		const toId = nameToId.get(rel.toTable.toLowerCase());

		if (fromId && toId) {
			// FK side = N, referenced side = 1
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

	// Scale 0-1000 → canvas coordinates
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

	// Check if at least half of entities have valid positions
	const hasPositions = data.entities.filter(e =>
		e.position && (e.position.x > 0 || e.position.y > 0)
	).length > data.entities.length / 2;

	return { entities, relationships, hasPositions };
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

// ========== Flowchart AI Parsing ==========

export interface AiParsedFlowchart {
	flowNodes: Array<{
		name: string;
		type: FlowNodeType;
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
}

export function convertAiFlowchartToDiagram(data: AiParsedFlowchart): ImportedFlowchartData {
	const flowNodes: FlowNode[] = [];
	const flowEdges: FlowEdge[] = [];
	const nameToId = new Map<string, string>();

	// Create nodes
	for (const node of data.flowNodes) {
		const nodeId = generateId();
		nameToId.set(node.name.toLowerCase(), nodeId);

		flowNodes.push({
			id: nodeId,
			name: node.name,
			type: node.type,
			position: { x: 0, y: 0 } // will be set by autoLayout
		});
	}

	// Create edges
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

	return { flowNodes, flowEdges };
}

// ========== DFD AI Parsing ==========

export interface AiParsedDFD {
	dfdNodes: Array<{
		name: string;
		type: DFDNodeType;
		processNumber?: string;
		storeNumber?: string;
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
}

export function convertAiDFDToDiagram(data: AiParsedDFD): ImportedDFDData {
	const dfdNodes: DFDNode[] = [];
	const dfdFlows: DFDFlow[] = [];
	const nameToId = new Map<string, string>();

	// Create nodes
	for (const node of data.dfdNodes) {
		const nodeId = generateId();
		nameToId.set(node.name.toLowerCase(), nodeId);

		dfdNodes.push({
			id: nodeId,
			name: node.name,
			type: node.type,
			position: { x: 0, y: 0 }, // will be set by autoLayout
			processNumber: node.processNumber,
			storeNumber: node.storeNumber
		});
	}

	// Create flows
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

	return { dfdNodes, dfdFlows };
}
