import type { Entity, Attribute, Relationship, AttributeType, SampleCell } from '$lib/types/er';




function sqliteType(attr: Attribute): string {
	if (attr.type === 'primary_key') return 'INTEGER';
	const n = attr.name.toLowerCase();
	if (/(^|_)id$|_id$|\bcount\b|\bqty\b|quantity|number|\bage\b|year/.test(n)) return 'INTEGER';
	if (/price|amount|total|cost|salary|rate|balance|decimal|amount/.test(n)) return 'REAL';
	if (/date|time|created|updated|timestamp/.test(n)) return 'TEXT';
	if (/is_|has_|active|enabled|flag/.test(n)) return 'INTEGER';
	return 'TEXT';
}


function ident(name: string): string {
	const clean = name.trim().replace(/"/g, '""');
	return `"${clean}"`;
}


const STORABLE: AttributeType[] = ['regular', 'primary_key', 'foreign_key', 'partial_key'];


export function storableAttributes(entity: Entity): Attribute[] {
	return entity.attributes.filter((a) => STORABLE.includes(a.type));
}

export interface DdlResult {
	ddl: string;
	
	columnsByTable: Map<string, string[]>;
	
	pkByTable: Map<string, string>;
	warnings: string[];
}


export function erToSqlite(entities: Entity[], relationships: Relationship[]): DdlResult {
	const warnings: string[] = [];
	const columnsByTable = new Map<string, string[]>();
	const pkByTable = new Map<string, string>();
	const entityById = new Map(entities.map((e) => [e.id, e]));

	
	const fkByEntity = new Map<string, { column: string; refTable: string; refCol: string }[]>();

	for (const rel of relationships) {
		const [aId, bId] = rel.entityIds;
		const a = entityById.get(aId);
		const b = entityById.get(bId);
		if (!a || !b) continue;

		
		const [ca, cb] = rel.cardinalities;
		const aIsMany = /N|M/i.test(ca);
		const bIsMany = /N|M/i.test(cb);

		let child = b;
		let parent = a;
		if (aIsMany && !bIsMany) {
			child = a;
			parent = b;
		} else if (bIsMany && !aIsMany) {
			child = b;
			parent = a;
		}
		
		if (aIsMany && bIsMany) {
			warnings.push(
				`ความสัมพันธ์ "${rel.name || `${a.name}-${b.name}`}" เป็น M:N — ควรมีตารางเชื่อม (junction table) แยกต่างหาก`
			);
		}

		const parentPk = parent.attributes.find((at) => at.type === 'primary_key');
		const refCol = parentPk ? parentPk.name : 'id';

		
		const childFk =
			child.attributes.find((at) => at.type === 'foreign_key') ?? null;
		const fkColName = childFk ? childFk.name : `${parent.name.toLowerCase().replace(/\s+/g, '_')}_id`;

		const list = fkByEntity.get(child.id) ?? [];
		list.push({ column: fkColName, refTable: parent.name, refCol });
		fkByEntity.set(child.id, list);
	}

	const statements: string[] = ['PRAGMA foreign_keys = ON;', ''];

	for (const entity of entities) {
		const cols: string[] = [];
		const colNames: string[] = [];
		const seen = new Set<string>();

		let pk = entity.attributes.find((a) => a.type === 'primary_key');
		const storable = entity.attributes.filter((a) => STORABLE.includes(a.type));

		
		if (!pk) {
			cols.push(`  ${ident('id')} INTEGER PRIMARY KEY AUTOINCREMENT`);
			colNames.push('id');
			seen.add('id');
			pkByTable.set(entity.name, 'id');
			warnings.push(`ตาราง "${entity.name}" ไม่มี Primary Key — เพิ่ม id ให้อัตโนมัติ`);
		}

		for (const attr of storable) {
			const key = attr.name.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			colNames.push(attr.name);

			if (attr.type === 'primary_key') {
				cols.push(`  ${ident(attr.name)} INTEGER PRIMARY KEY AUTOINCREMENT`);
				pkByTable.set(entity.name, attr.name);
			} else {
				cols.push(`  ${ident(attr.name)} ${sqliteType(attr)}`);
			}
		}

		
		const fks = fkByEntity.get(entity.id) ?? [];
		const fkConstraints: string[] = [];
		for (const fk of fks) {
			if (!seen.has(fk.column.toLowerCase())) {
				seen.add(fk.column.toLowerCase());
				colNames.push(fk.column);
				cols.push(`  ${ident(fk.column)} INTEGER`);
			}
			fkConstraints.push(
				`  FOREIGN KEY (${ident(fk.column)}) REFERENCES ${ident(fk.refTable)} (${ident(fk.refCol)})`
			);
		}

		const allLines = [...cols, ...fkConstraints];
		statements.push(`CREATE TABLE ${ident(entity.name)} (\n${allLines.join(',\n')}\n);`);
		statements.push('');

		columnsByTable.set(entity.name, colNames);
	}

	return {
		ddl: statements.join('\n').trim() + '\n',
		columnsByTable,
		pkByTable,
		warnings
	};
}


export function generateSampleData(
	entities: Entity[],
	columnsByTable: Map<string, string[]>,
	pkByTable: Map<string, string>,
	rowsPerTable = 3
): string {
	const lines: string[] = [];
	const entityByName = new Map(entities.map((e) => [e.name, e]));

	for (const [table, columns] of columnsByTable) {
		const entity = entityByName.get(table);
		if (!entity) continue;
		const pk = pkByTable.get(table);

		
		const insertCols = columns.filter((c) => c !== pk);
		if (insertCols.length === 0) continue;

		const attrByName = new Map(entity.attributes.map((a) => [a.name.toLowerCase(), a]));

		for (let i = 1; i <= rowsPerTable; i++) {
			const values = insertCols.map((col) =>
				sqlQuote(sampleValue(col, attrByName.get(col.toLowerCase()), i))
			);
			lines.push(
				`INSERT INTO ${ident(table)} (${insertCols.map(ident).join(', ')}) VALUES (${values.join(', ')});`
			);
		}
	}

	return lines.join('\n') + (lines.length ? '\n' : '');
}


export function sampleValue(col: string, attr: Attribute | undefined, i: number): SampleCell {
	const n = col.toLowerCase();
	
	if (/_id$|(^|_)id$/.test(n)) return i;
	if (attr && /price|amount|total|cost|salary|rate|balance/.test(n)) return i * 100 + 0.99;
	if (/date|created|updated|timestamp/.test(n)) return `2024-0${((i - 1) % 9) + 1}-15`;
	if (/is_|has_|active|enabled|flag/.test(n)) return i % 2;
	if (/count|qty|quantity|number|age|year/.test(n)) return i * 5;
	if (/email/.test(n)) return `user${i}@example.com`;
	if (/name|title|label/.test(n)) return `${col} ${i}`;
	if (attr && sqliteType(attr) === 'INTEGER') return i;
	if (attr && sqliteType(attr) === 'REAL') return i * 1.5;
	return `${col}_${i}`;
}


export function sqlQuote(value: SampleCell): string {
	if (value === null) return 'NULL';
	if (typeof value === 'number') return String(value);
	
	return `'${String(value).replace(/'/g, "''")}'`;
}
