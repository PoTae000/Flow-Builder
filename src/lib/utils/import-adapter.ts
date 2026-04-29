import type { Entity, Relationship, Attribute, AttributeType, CardinalityType } from '$lib/types/er';
import type { ParsedResult, ParsedRelationship } from './sql-parser';
import { generateId } from './id';

export interface ImportedDiagramData {
	entities: Entity[];
	relationships: Relationship[];
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
			position: { x: 0, y: 0 },
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

	return { entities, relationships };
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
