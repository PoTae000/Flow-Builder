import type { Entity, Attribute, Relationship } from '$lib/types/er';




function guessType(attr: Attribute): string {
	if (attr.sqlType && /^[A-Z][A-Z0-9_ ]*(?:\(\d+(?:,\s*\d+)?\))?(?:\[\])?$/i.test(attr.sqlType)) return attr.sqlType;
	if (attr.type === 'primary_key') return 'INTEGER';
	const n = attr.name.toLowerCase();
	if (/(^|_)id$|_id$|\bcount\b|\bqty\b|quantity|number|\bage\b|year/.test(n)) return 'INTEGER';
	if (/price|amount|total|cost|salary|rate|balance|decimal/.test(n)) return 'DECIMAL(10,2)';
	if (/date|time|created|updated|timestamp/.test(n)) return 'TIMESTAMP';
	if (/is_|has_|active|enabled|flag/.test(n)) return 'BOOLEAN';
	if (/desc|description|content|body|note|text/.test(n)) return 'TEXT';
	return 'VARCHAR(255)';
}


function ident(name: string): string {
	return `"${name.trim().replace(/"/g, '""')}"`;
}


function snake(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

const STORABLE = new Set<Attribute['type']>(['regular', 'primary_key', 'foreign_key', 'partial_key']);

export interface GenerateSqlResult {
	sql: string;
	warnings: string[];
}

export function generateErSql(entities: Entity[], relationships: Relationship[]): GenerateSqlResult {
	const warnings: string[] = [];
	const entityById = new Map(entities.map((e) => [e.id, e]));


	const fkByEntity = new Map<string, { column: string; refTable: string; refCol: string }[]>();
	const junctionTables: { name: string; a: Entity; b: Entity }[] = [];

	for (const rel of relationships) {
		const [aId, bId] = rel.entityIds;
		const a = entityById.get(aId);
		const b = entityById.get(bId);
		if (!a || !b) continue;

		const [ca, cb] = rel.cardinalities;
		const aMany = /N|M/i.test(ca);
		const bMany = /N|M/i.test(cb);


		if (aMany && bMany) {
			const jname = rel.name?.trim() ? snake(rel.name) : `${snake(a.name)}_${snake(b.name)}`;
			junctionTables.push({ name: jname, a, b });
			continue;
		}


		let child = b;
		let parent = a;
		if (aMany && !bMany) {
			child = a;
			parent = b;
		}

		const parentPk = parent.attributes.find((at) => at.type === 'primary_key');
		const refCol = parentPk ? parentPk.name : 'id';


		const childFk = child.attributes.find((at) => at.sqlReferences?.table.toLowerCase() === parent.name.toLowerCase()) ?? child.attributes.find((at) => at.type === 'foreign_key' && !at.sqlReferences) ?? null;
		const fkColName = childFk ? childFk.name : `${snake(parent.name)}_id`;

		const list = fkByEntity.get(child.id) ?? [];
		list.push({ column: fkColName, refTable: parent.name, refCol });
		fkByEntity.set(child.id, list);
	}

	const statements: string[] = [];

	for (const entity of entities) {
		const lines: string[] = [];
		const seen = new Set<string>();

		const primaryKeys = entity.attributes.filter(a => a.type === 'primary_key');
		const hasPk = primaryKeys.length > 0;
		if (!hasPk) {
			lines.push(`  ${ident('id')} INTEGER PRIMARY KEY`);
			seen.add('id');
			warnings.push(`ตาราง "${entity.name}" ไม่มี Primary Key — เพิ่ม id ให้อัตโนมัติ`);
		}

		for (const attr of entity.attributes) {
			if (!STORABLE.has(attr.type)) continue;
			const key = attr.name.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);

			if (attr.type === 'primary_key') {
				lines.push(`  ${ident(attr.name)} ${guessType(attr)}${primaryKeys.length === 1 ? ' PRIMARY KEY' : ''}`);
			} else {
				lines.push(`  ${ident(attr.name)} ${guessType(attr)}`);
			}
		}


		if (primaryKeys.length > 1) lines.push(`  PRIMARY KEY (${primaryKeys.map(a => ident(a.name)).join(', ')})`);
		const fks = fkByEntity.get(entity.id) ?? [];
		for (const fk of fks) {
			if (!seen.has(fk.column.toLowerCase())) {
				seen.add(fk.column.toLowerCase());
				lines.push(
					`  ${ident(fk.column)} INTEGER REFERENCES ${ident(fk.refTable)} (${ident(fk.refCol)})`
				);
			} else {

				lines.push(
					`  FOREIGN KEY (${ident(fk.column)}) REFERENCES ${ident(fk.refTable)} (${ident(fk.refCol)})`
				);
			}
		}

		statements.push(`CREATE TABLE ${ident(entity.name)} (\n${lines.join(',\n')}\n);`);
	}



	for (const j of junctionTables) {
		const aPk = j.a.attributes.find((at) => at.type === 'primary_key');
		const bPk = j.b.attributes.find((at) => at.type === 'primary_key');
		const aCol = `${snake(j.a.name)}_id`;
		const bCol = `${snake(j.b.name)}_id`;
		const lines = [
			`  ${ident(aCol)} INTEGER REFERENCES ${ident(j.a.name)} (${ident(aPk ? aPk.name : 'id')})`,
			`  ${ident(bCol)} INTEGER REFERENCES ${ident(j.b.name)} (${ident(bPk ? bPk.name : 'id')})`,
			`  PRIMARY KEY (${ident(aCol)}, ${ident(bCol)})`
		];
		statements.push(`CREATE TABLE ${ident(j.name)} (\n${lines.join(',\n')}\n);`);
	}

	return { sql: statements.join('\n\n') + (statements.length ? '\n' : ''), warnings };
}
