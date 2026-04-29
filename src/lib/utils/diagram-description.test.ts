import { describe, it, expect } from 'vitest';
import {
	buildDiagramDescription,
	buildCompactDiagramDescription,
	buildLayoutDescription
} from './diagram-description';
import type { EntityData, RelationshipData } from './diagram-description';

const entities: EntityData[] = [
	{
		id: 'e1',
		name: 'Student',
		attributes: [
			{ name: 'id', type: 'primary_key' },
			{ name: 'name', type: 'regular' }
		],
		isWeak: false
	},
	{
		id: 'e2',
		name: 'Course',
		attributes: [{ name: 'id', type: 'primary_key' }],
		isWeak: false
	}
];

const relationships: RelationshipData[] = [
	{
		name: 'enrolls',
		entityIds: ['e1', 'e2'],
		cardinalities: ['N', 'M'],
		isIdentifying: false
	}
];

describe('buildDiagramDescription', () => {
	it('includes entity names and attributes', () => {
		const desc = buildDiagramDescription(entities, relationships);
		expect(desc).toContain('### Student');
		expect(desc).toContain('### Course');
		expect(desc).toContain('- id [primary_key]');
		expect(desc).toContain('- name [regular]');
	});

	it('includes relationship info', () => {
		const desc = buildDiagramDescription(entities, relationships);
		expect(desc).toContain('Student');
		expect(desc).toContain('Course');
		expect(desc).toContain('"enrolls"');
		expect(desc).toContain('[N]');
		expect(desc).toContain('[M]');
	});

	it('marks weak entities', () => {
		const weakEntities: EntityData[] = [
			{ id: 'w1', name: 'WeakE', attributes: [], isWeak: true }
		];
		const desc = buildDiagramDescription(weakEntities, []);
		expect(desc).toContain('(Weak Entity)');
	});

	it('uses custom header prefix', () => {
		const desc = buildDiagramDescription(entities, [], { headerPrefix: 'Current ' });
		expect(desc).toContain('## Current Entities');
		expect(desc).toContain('## Current Relationships');
	});

	it('shows (none) for empty attributes', () => {
		const noAttr: EntityData[] = [
			{ id: 'n1', name: 'Empty', attributes: [], isWeak: false }
		];
		const desc = buildDiagramDescription(noAttr, []);
		expect(desc).toContain('- (none)');
	});

	it('shows (none) for empty relationships', () => {
		const desc = buildDiagramDescription(entities, []);
		expect(desc).toContain('(none)');
	});

	it('sanitizes names with dangerous characters', () => {
		const dangerous: EntityData[] = [
			{
				id: 'd1',
				name: "Student'; DROP TABLE--",
				attributes: [{ name: "id'; --", type: 'primary_key' }],
				isWeak: false
			}
		];
		const desc = buildDiagramDescription(dangerous, []);
		expect(desc).not.toContain("'");
		expect(desc).not.toContain(';');
		expect(desc).not.toContain('--');
	});

	it('marks identifying relationships', () => {
		const idRels: RelationshipData[] = [
			{
				name: 'has',
				entityIds: ['e1', 'e2'],
				cardinalities: ['1', 'N'],
				isIdentifying: true
			}
		];
		const desc = buildDiagramDescription(entities, idRels);
		expect(desc).toContain('(identifying)');
	});
});

describe('buildCompactDiagramDescription', () => {
	it('produces compact format', () => {
		const desc = buildCompactDiagramDescription(entities, relationships);
		expect(desc).toContain('Entities:');
		expect(desc).toContain('Relationships:');
		expect(desc).toContain('Student');
		expect(desc).toContain('id[primary_key]');
	});

	it('shows (no attrs) for entities without attributes', () => {
		const noAttr: EntityData[] = [
			{ id: 'n1', name: 'Empty', attributes: [], isWeak: false }
		];
		const desc = buildCompactDiagramDescription(noAttr, []);
		expect(desc).toContain('(no attrs)');
	});
});

describe('buildLayoutDescription', () => {
	it('includes notation and entity count', () => {
		const desc = buildLayoutDescription(entities, relationships, 'crows-foot');
		expect(desc).toContain('Notation: crows-foot');
		expect(desc).toContain('Number of entities: 2');
	});

	it('includes entity IDs and pixel widths', () => {
		const desc = buildLayoutDescription(entities, relationships, 'chen');
		expect(desc).toContain('"e1"');
		expect(desc).toContain('"e2"');
		expect(desc).toContain('px wide');
	});

	it('includes relationship connections', () => {
		const desc = buildLayoutDescription(entities, relationships, 'crows-foot');
		expect(desc).toContain('"Student"');
		expect(desc).toContain('"Course"');
		expect(desc).toContain('"enrolls"');
	});
});
