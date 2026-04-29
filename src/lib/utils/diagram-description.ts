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
 * Build a layout-specific diagram description (includes notation and pixel widths).
 */
export function buildLayoutDescription(
	entities: EntityData[],
	relationships: RelationshipData[],
	notation: string
): string {
	const entityMap = new Map(entities.map((e) => [e.id, sanitizeName(e.name)]));

	let desc = `Notation: ${notation}\n`;
	desc += `Number of entities: ${entities.length}\n\n`;
	desc += 'Entities (id → name [attribute count]):\n';
	for (const e of entities) {
		const name = sanitizeName(e.name);
		desc += `- "${e.id}" → "${name}" (${e.attributes.length} attrs, ~${Math.max(120, name.length * 9 + 32)}px wide)${e.isWeak ? ' [weak]' : ''}\n`;
	}

	desc += '\nRelationships (connections between entities):\n';
	for (const r of relationships) {
		const fromName = entityMap.get(r.entityIds[0]) || '?';
		const toName = entityMap.get(r.entityIds[1]) || '?';
		desc += `- "${fromName}" (${r.entityIds[0]}) ←→ "${toName}" (${r.entityIds[1]}): "${sanitizeName(r.name)}" [${r.cardinalities[0]}:${r.cardinalities[1]}]\n`;
	}

	return desc;
}
