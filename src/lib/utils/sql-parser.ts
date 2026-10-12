export interface ParsedColumn {
	name: string;
	type: string;
	isPrimaryKey: boolean;
	isForeignKey: boolean;
	references?: { table: string; column: string };
}

export interface ParsedTable {
	name: string;
	columns: ParsedColumn[];
}

export interface ParsedRelationship {
	fromTable: string;
	fromColumn: string;
	toTable: string;
	toColumn: string;
	isJunction: boolean;
}

export interface ParsedResult {
	tables: ParsedTable[];
	relationships: ParsedRelationship[];
	warnings: string[];
}


function stripCopyBlocks(sql: string): string {
	return sql.replace(/^COPY\b[\s\S]*?^\\\.$/gim, '');
}


function stripSchemaQualifiers(sql: string): string {
	const qualifier = /(?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[A-Za-z_]\w*)\s*\.\s*(?=`|"|\[|[A-Za-z_])/g;
	let prev = '';
	let cur = sql;
	let passes = 0;
	while (cur !== prev && passes < 3) {
		prev = cur;
		cur = cur.replace(qualifier, '');
		passes++;
	}
	return cur;
}


function extractBalanced(text: string, openIndex: number): string | null {
	let depth = 0;
	let quote: string | null = null;
	for (let i = openIndex; i < text.length; i++) {
		const ch = text[i];
		if (quote) {
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === "'" || ch === '"' || ch === '`') {
			quote = ch;
			continue;
		}
		if (ch === '(') depth++;
		else if (ch === ')') {
			depth--;
			if (depth === 0) return text.slice(openIndex + 1, i);
		}
	}
	return null;
}

export function parseSqlDdl(sql: string, strict = false): ParsedResult {
	const tables: ParsedTable[] = [];
	const relationships: ParsedRelationship[] = [];
	const warnings: string[] = [];




	const cleaned = stripSchemaQualifiers(
		stripCopyBlocks(
			sql
				.replace(/--.*$/gm, '')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\r\n/g, '\n')
		)
	);





	const headerRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\(/gi;
	let match;
	while ((match = headerRegex.exec(cleaned)) !== null) {
		const tableName = match[1];
		const openParen = headerRegex.lastIndex - 1;
		const body = extractBalanced(cleaned, openParen);
		if (body === null) continue;
		const table = parseTableBody(tableName, body, warnings, strict);
		tables.push(table);

		headerRegex.lastIndex = openParen + body.length + 2;
	}

	if (tables.length === 0) {
		warnings.push('No CREATE TABLE statements found in the SQL.');
	}


	const tableNames = new Set(tables.map((t) => t.name.toLowerCase()));

	for (const table of tables) {
		for (const col of table.columns) {
			if (col.references) {
				relationships.push({
					fromTable: table.name,
					fromColumn: col.name,
					toTable: col.references.table,
					toColumn: col.references.column,
					isJunction: false
				});
			}
		}
	}




	const alterPkRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s+ADD\s+(?:CONSTRAINT\s+(?:`|"|'|\[)?\w+(?:`|"|'|\])?\s+)?PRIMARY\s+KEY\s*\(\s*([\s\S]*?)\s*\)/gi;
	while ((match = alterPkRegex.exec(cleaned)) !== null) {
		const tblName = match[1];
		const cols = match[2].split(',').map((c) => c.trim().replace(/`|"|'|\[|\]/g, ''));
		const table = tables.find((t) => t.name.toLowerCase() === tblName.toLowerCase());
		if (table) {
			for (const pkCol of cols) {
				const col = table.columns.find((c) => c.name.toLowerCase() === pkCol.toLowerCase());
				if (col) col.isPrimaryKey = true;
			}
		}
	}


	const alterFkRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s+ADD\s+(?:CONSTRAINT\s+(?:`|"|'|\[)?\w+(?:`|"|'|\])?\s+)?FOREIGN\s+KEY\s*\(\s*(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\)\s*REFERENCES\s+(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\(\s*(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\)/gi;
	while ((match = alterFkRegex.exec(cleaned)) !== null) {
		const fromTable = match[1];
		const fromCol = match[2];
		const toTable = match[3];
		const toCol = match[4];


		const table = tables.find((t) => t.name.toLowerCase() === fromTable.toLowerCase());
		if (table) {
			const col = table.columns.find((c) => c.name.toLowerCase() === fromCol.toLowerCase());
			if (col) {
				col.isForeignKey = true;
				col.references = { table: toTable, column: toCol };
			}
		}

		relationships.push({
			fromTable,
			fromColumn: fromCol,
			toTable,
			toColumn: toCol,
			isJunction: false
		});
	}


	for (const table of tables) {
		const fkCols = table.columns.filter((c) => c.isForeignKey);
		const pkCols = table.columns.filter((c) => c.isPrimaryKey);

		if (fkCols.length >= 2 && pkCols.length >= 2) {
			const fkNames = new Set(fkCols.map((c) => c.name.toLowerCase()));
			const pkNames = new Set(pkCols.map((c) => c.name.toLowerCase()));
			const overlap = [...fkNames].filter((n) => pkNames.has(n));

			if (overlap.length >= 2) {

				for (const rel of relationships) {
					if (rel.fromTable.toLowerCase() === table.name.toLowerCase()) {
						rel.isJunction = true;
					}
				}
			}
		}
	}

	return { tables, relationships, warnings };
}

function parseTableBody(tableName: string, body: string, warnings: string[], strict = false): ParsedTable {
	const columns: ParsedColumn[] = [];
	const compositePkColumns: string[] = [];


	const parts = splitByComma(body);

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		const upper = trimmed.toUpperCase();


		if (/^\s*PRIMARY\s+KEY\s*/i.test(trimmed)) {
			const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(\s*([\s\S]*?)\s*\)/i);
			if (pkMatch) {
				const cols = pkMatch[1].split(',').map((c) => c.trim().replace(/`|"|'|\[|\]/g, ''));
				compositePkColumns.push(...cols);
			}
			continue;
		}



		if (/^\s*(?:CONSTRAINT\s+(?:`|"|'|\[)?\w+(?:`|"|'|\])?\s+)?FOREIGN\s+KEY/i.test(trimmed)) {
			const fkMatch = trimmed.match(
				/FOREIGN\s+KEY\s*\(\s*(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\)\s*REFERENCES\s+(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\(\s*(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\)/i
			);
			if (fkMatch) {
				const colName = fkMatch[1];
				const refTable = fkMatch[2];
				const refCol = fkMatch[3];

				const existingCol = columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
				if (existingCol) {
					existingCol.isForeignKey = true;
					existingCol.references = { table: refTable, column: refCol };
				}
			}
			continue;
		}


		if (/^\s*(UNIQUE|INDEX|KEY|CHECK|CONSTRAINT)\s/i.test(trimmed)) {
			continue;
		}


		const colMatch = trimmed.match(
			/^(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s+(\w+(?:\([^)]*\))?(?:\s+\w+)*)/i
		);
		if (colMatch) {
			const colName = colMatch[1];
			const rest = colMatch[2];
			const upperRest = rest.toUpperCase();

			const isPK = /PRIMARY\s+KEY/i.test(upperRest) || /\bSERIAL\b/i.test(upperRest);


			let references: { table: string; column: string } | undefined;
			const inlineRef = trimmed.match(
				/REFERENCES\s+(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\(\s*(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\)/i
			);
			if (inlineRef) {
				references = { table: inlineRef[1], column: inlineRef[2] };
			}

			columns.push({
				name: colName,
				type: extractDataType(rest),
				isPrimaryKey: isPK,
				isForeignKey: !!references,
				references
			});
		} else if (strict) {
			warnings.push(`Cannot parse column in ${tableName}: ${trimmed}`);
		}
	}


	for (const pkCol of compositePkColumns) {
		const col = columns.find((c) => c.name.toLowerCase() === pkCol.toLowerCase());
		if (col) col.isPrimaryKey = true;
	}

	if (columns.length === 0) {
		warnings.push(`Table "${tableName}" has no columns parsed.`);
	}

	return { name: tableName, columns };
}

function splitByComma(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = '';

	for (const ch of text) {
		if (ch === '(') depth++;
		else if (ch === ')') depth--;

		if (ch === ',' && depth === 0) {
			parts.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	if (current.trim()) parts.push(current);
	return parts;
}

function extractDataType(rest: string): string {

	const match = rest.match(/^(\w+(?:\([^)]*\))?(?:\s+UNSIGNED)?)/i);
	return match ? match[1].toUpperCase() : 'TEXT';
}
