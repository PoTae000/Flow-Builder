import { sanitizeName } from './sanitize';

export interface EntityData {
	id: string;
	name: string;
	attributes: Array<{ name: string; type: string }>;
	isWeak: boolean;
}

export interface RelationshipData {
	name: string;
	entityIds: [string, string];
	cardinalities: [string, string];
	isIdentifying?: boolean;
}

/**
 * Build a markdown description of an ER diagram for AI prompts.
 * All entity/attribute/relationship names are sanitized to prevent injection.
 */
export function buildDiagramDescription(
	entities: EntityData[],
	relationships: RelationshipData[],
	options?: { headerPrefix?: string }
): string {
	const prefix = options?.headerPrefix ?? '';
	const entityMap = new Map(entities.map((e) => [e.id, sanitizeName(e.name)]));

	let desc = `## ${prefix}Entities\n\n`;
	for (const entity of entities) {
		const name = sanitizeName(entity.name);
		desc += `### ${name}${entity.isWeak ? ' (Weak Entity)' : ''}\n`;
		desc += 'Attributes:\n';
		if (entity.attributes.length === 0) {
			desc += '- (none)\n';
		}
		for (const attr of entity.attributes) {
			desc += `- ${sanitizeName(attr.name)} [${attr.type}]\n`;
		}
		desc += '\n';
	}

	desc += `## ${prefix}Relationships\n\n`;
	if (relationships.length === 0) {
		desc += '(none)\n';
	}
	for (const rel of relationships) {
		const fromName = entityMap.get(rel.entityIds[0]) || '?';
		const toName = entityMap.get(rel.entityIds[1]) || '?';
		desc += `- ${fromName} --[${rel.cardinalities[0]}]-- "${sanitizeName(rel.name)}" --[${rel.cardinalities[1]}]-- ${toName}`;
		if (rel.isIdentifying) desc += ' (identifying)';
		desc += '\n';
	}

	return desc;
}

/**
 * Build a compact diagram description (used for chat context).
 */
export function buildCompactDiagramDescription(
	entities: EntityData[],
	relationships: RelationshipData[]
): string {
	const entityMap = new Map(entities.map((e) => [e.id, sanitizeName(e.name)]));

	let desc = 'Entities:\n';
	for (const e of entities) {
		const name = sanitizeName(e.name);
		const attrs = e.attributes.map((a) => `${sanitizeName(a.name)}[${a.type}]`).join(', ') || '(no attrs)';
		desc += `- ${name}${e.isWeak ? ' (Weak)' : ''}: ${attrs}\n`;
	}
	desc += '\nRelationships:\n';
	for (const r of relationships) {
		desc += `- ${entityMap.get(r.entityIds[0])} -[${r.cardinalities[0]}]- "${sanitizeName(r.name)}" -[${r.cardinalities[1]}]- ${entityMap.get(r.entityIds[1])}\n`;
	}
	return desc;
}

/**
 * Build a layout-specific diagram description (includes notation, pixel sizes, and degree).
 */
export function buildLayoutDescription(
	entities: EntityData[],
	relationships: RelationshipData[],
	notation: string
): string {
	const entityMap = new Map(entities.map((e) => [e.id, sanitizeName(e.name)]));

	// Compute degree (connection count) per entity
	const degree = new Map<string, number>();
	for (const e of entities) degree.set(e.id, 0);
	for (const r of relationships) {
		degree.set(r.entityIds[0], (degree.get(r.entityIds[0]) ?? 0) + 1);
		degree.set(r.entityIds[1], (degree.get(r.entityIds[1]) ?? 0) + 1);
	}

	// Determine hub threshold (entities with degree >= median+2 or top 20%)
	const degrees = [...degree.values()].sort((a, b) => b - a);
	const hubThreshold = degrees.length > 3 ? Math.max(3, degrees[Math.floor(degrees.length * 0.2)]) : Infinity;

	let desc = `Notation: ${notation}\n`;
	desc += `Number of entities: ${entities.length}\n`;
	desc += `Number of relationships: ${relationships.length}\n\n`;
	desc += 'Entities (id → name [size info, connections]):\n';
	for (const e of entities) {
		const name = sanitizeName(e.name);
		const isChen = notation === 'chen';
		const charWidth = isChen ? 9 : 8;
		const nameWidth = name.length * charWidth + 32;
		const attrWidths = e.attributes.map((a) => a.name.length * charWidth + 52);
		const maxAttrWidth = attrWidths.length > 0 ? Math.max(...attrWidths) : 0;
		const w = isChen ? Math.max(120, nameWidth) : Math.max(160, nameWidth, maxAttrWidth);
		const h = isChen ? 48 : 40 + Math.max(e.attributes.length, 1) * 24 + 8;
		const deg = degree.get(e.id) ?? 0;
		const isHub = deg >= hubThreshold;
		desc += `- "${e.id}" → "${name}" (${e.attributes.length} attrs, ~${w}px wide, ~${h}px tall, ${deg} connections)${e.isWeak ? ' [weak]' : ''}${isHub ? ' [HUB]' : ''}\n`;
	}

	desc += '\nRelationships (connections between entities):\n';
	for (const r of relationships) {
		const fromName = entityMap.get(r.entityIds[0]) || '?';
		const toName = entityMap.get(r.entityIds[1]) || '?';
		desc += `- "${fromName}" (${r.entityIds[0]}) ←→ "${toName}" (${r.entityIds[1]}): "${sanitizeName(r.name)}" [${r.cardinalities[0]}:${r.cardinalities[1]}]\n`;
	}

	return desc;
}
