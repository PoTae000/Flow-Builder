import type { Entity, Relationship } from '$lib/types/er';

export function generateMarkdownDocs(entities: Entity[], relationships: Relationship[]): string {
	const lines: string[] = [];
	const today = new Date().toISOString().slice(0, 10);

	lines.push('# ER Diagram Documentation');
	lines.push('');
	lines.push(`Generated: ${today}`);
	lines.push('');

	// --- Entities ---
	lines.push('## Entities');
	lines.push('');

	const entityMap = new Map(entities.map((e) => [e.id, e]));

	for (const entity of entities) {
		lines.push(`### ${entity.name}`);
		lines.push('');

		if (entity.attributes.length === 0) {
			lines.push('_No attributes defined._');
			lines.push('');
			continue;
		}

		lines.push('| Attribute | Type |');
		lines.push('| --- | --- |');

		for (const attr of entity.attributes) {
			const typeLabel = formatAttributeType(attr.type);
			lines.push(`| ${attr.name} | ${typeLabel} |`);
		}

		lines.push('');
	}

	// --- Relationships ---
	lines.push('## Relationships');
	lines.push('');

	if (relationships.length === 0) {
		lines.push('_No relationships defined._');
		lines.push('');
	} else {
		lines.push('| Relationship | Entity 1 | Entity 2 | Cardinality |');
		lines.push('| --- | --- | --- | --- |');

		for (const rel of relationships) {
			const entity1 = entityMap.get(rel.entityIds[0])?.name ?? rel.entityIds[0];
			const entity2 = entityMap.get(rel.entityIds[1])?.name ?? rel.entityIds[1];
			const cardinality = `${rel.cardinalities[0]}:${rel.cardinalities[1]}`;
			lines.push(`| ${rel.name} | ${entity1} | ${entity2} | ${cardinality} |`);
		}

		lines.push('');
	}

	// --- Summary ---
	lines.push('## Summary');
	lines.push('');
	lines.push(`- **Entities:** ${entities.length}`);
	lines.push(`- **Relationships:** ${relationships.length}`);
	lines.push('');

	return lines.join('\n');
}

function formatAttributeType(type: string): string {
	switch (type) {
		case 'primary_key':
			return 'PK';
		case 'foreign_key':
			return 'FK';
		case 'partial_key':
			return 'Partial Key';
		case 'derived':
			return 'Derived';
		case 'multivalued':
			return 'Multivalued';
		case 'composite':
			return 'Composite';
		case 'regular':
		default:
			return 'Regular';
	}
}
