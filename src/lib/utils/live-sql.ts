import type { Entity, Relationship } from '$lib/types/er';
import { parseSqlDdl } from './sql-parser';
import { convertToDiagramData } from './import-adapter';

// Require a complete document before replacing any schema. Import parsing is
// deliberately lenient, which is unsafe while someone is still typing.
export function parseLiveSql(text: string) {
	let cleaned = '', quote = '', comment = '', depth = 0;
	for (let i = 0; i < text.length; i++) {
		const c = text[i], next = text[i + 1];
		if (comment === 'line') { if (c === '\n') { comment = ''; cleaned += '\n'; } continue; }
		if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i++; cleaned += ' '; } continue; }
		if (quote) {
			cleaned += c;
			if (c === quote) { if (next === quote) { cleaned += next; i++; } else quote = ''; }
			continue;
		}
		if (c === '-' && next === '-') { comment = 'line'; i++; continue; }
		if (c === '/' && next === '*') { comment = 'block'; i++; continue; }
		if (['"', "'", '`'].includes(c)) quote = c;
		if (c === '(') depth++;
		if (c === ')') depth--;
		if (depth < 0) throw new Error('วงเล็บ SQL ไม่ถูกต้อง');
		cleaned += c;
	}
	if (quote || comment === 'block' || depth !== 0 || !cleaned.trim().endsWith(';')) throw new Error('SQL ยังไม่ครบ — ปิดวงเล็บและจบคำสั่งด้วย ;');
	if (!/^\s*CREATE\s+TABLE\b/i.test(cleaned)) throw new Error('ใช้ CREATE TABLE เพื่อกำหนดโครงสร้างทั้งหมด');
	const parsed = parseSqlDdl(text, true);
	const count = (cleaned.match(/\bCREATE\s+TABLE\b/gi) ?? []).length;
	if (!parsed.tables.length || parsed.tables.length !== count || parsed.warnings.length) throw new Error('มีตารางที่อ่านไม่ได้ กรุณาตรวจ SQL ให้ครบ');
	const names = new Set<string>();
	for (const table of parsed.tables) {
		const name = table.name.toLowerCase();
		if (names.has(name)) throw new Error(`ชื่อตารางซ้ำ: ${table.name}`);
		names.add(name);
		const columns = table.columns.map(c => c.name.toLowerCase());
		if (new Set(columns).size !== columns.length) throw new Error(`ชื่อคอลัมน์ซ้ำใน ${table.name}`);
	}
	for (const table of parsed.tables) for (const column of table.columns) {
		if (!column.references) continue;
		const target = parsed.tables.find(t => t.name.toLowerCase() === column.references!.table.toLowerCase());
		if (!target) throw new Error(`ยังลบหรือเปลี่ยนชื่อตาราง "${column.references.table}" ไม่ได้: "${table.name}"."${column.name}" ยัง REFERENCES ถึงตารางนี้อยู่ ลบ REFERENCES หรือคอลัมน์ที่อ้างถึง หรือแก้ชื่อปลายทางให้ตรงกันก่อน — diagram เดิมยังคงอยู่`);
		if (!target.columns.some(c => c.name.toLowerCase() === column.references!.column.toLowerCase())) throw new Error(`ยังลบหรือเปลี่ยนชื่อคอลัมน์ "${target.name}"."${column.references.column}" ไม่ได้: "${table.name}"."${column.name}" ยัง REFERENCES ถึงคอลัมน์นี้อยู่ ลบหรือแก้ REFERENCES ให้ตรงกันก่อน — diagram เดิมยังคงอยู่`);
	}
	return parsed;
}

export function reconcileLiveSql(text: string, previous: Entity[], previousRelations: Relationship[]) {
	const parsed = parseLiveSql(text);
	const data = convertToDiagramData({ ...parsed, relationships: parsed.relationships.map(r => ({ ...r, isJunction: false })) });
	const idMap = new Map<string, string>();
	const entities = data.entities.map((entity, index) => {
		const old = previous.find(e => e.name.toLowerCase() === entity.name.toLowerCase());
		idMap.set(entity.id, old?.id ?? entity.id);
		const columns = parsed.tables[index].columns;
		return {
			...old, ...entity, id: old?.id ?? entity.id,
			isWeak: old?.isWeak ?? false,
			position: old ? { ...old.position } : { x: 100 + (index % 3) * 260, y: 100 + Math.floor(index / 3) * 220 },
			attributes: entity.attributes.map((attr, i) => ({ ...old?.attributes.find(a => a.name.toLowerCase() === attr.name.toLowerCase()), ...attr, id: old?.attributes.find(a => a.name.toLowerCase() === attr.name.toLowerCase())?.id ?? attr.id, sqlType: columns[i].type, sqlReferences: columns[i].references }))
		};
	});
	const reused = new Set<string>();
	const relationships = data.relationships.map(rel => {
		const ids = rel.entityIds.map(id => idMap.get(id) ?? id) as [string, string];
		const old = previousRelations.find(r => !reused.has(r.id) && r.entityIds[0] === ids[0] && r.entityIds[1] === ids[1]);
		if (old) reused.add(old.id);
		return { ...rel, ...old, entityIds: ids };
	});
	return { entities, relationships };
}
