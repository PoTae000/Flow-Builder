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

export function parseSqlDdl(sql: string): ParsedResult {
	const tables: ParsedTable[] = [];
	const relationships: ParsedRelationship[] = [];
	const warnings: string[] = [];

	// Normalize: remove comments, collapse whitespace
	const cleaned = sql
		.replace(/--.*$/gm, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\r\n/g, '\n');

	// Extract CREATE TABLE blocks
	const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\(([\s\S]*?)\)\s*(?:ENGINE|DEFAULT|CHARSET|COLLATE|WITH|;)/gi;

	let match;
	while ((match = tableRegex.exec(cleaned)) !== null) {
		const tableName = match[1];
		const body = match[2];
		const table = parseTableBody(tableName, body, warnings);
		tables.push(table);
	}

	// Fallback: simpler regex if no matches
	if (tables.length === 0) {
		const simpleRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\(([\s\S]*?)\);/gi;
		while ((match = simpleRegex.exec(cleaned)) !== null) {
			const tableName = match[1];
			const body = match[2];
			const table = parseTableBody(tableName, body, warnings);
			tables.push(table);
		}
	}

	if (tables.length === 0) {
		warnings.push('No CREATE TABLE statements found in the SQL.');
	}

	// Extract relationships from FK references
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

	// Also parse standalone ALTER TABLE ... ADD FOREIGN KEY
	const alterFkRegex = /ALTER\s+TABLE\s+(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(\s*(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\)\s*REFERENCES\s+(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\(\s*(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s*\)/gi;
	while ((match = alterFkRegex.exec(cleaned)) !== null) {
		const fromTable = match[1];
		const fromCol = match[2];
		const toTable = match[3];
		const toCol = match[4];

		// Mark FK on the column if table exists
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

	// Detect junction tables (exactly 2 FKs that form the PK)
	for (const table of tables) {
		const fkCols = table.columns.filter((c) => c.isForeignKey);
		const pkCols = table.columns.filter((c) => c.isPrimaryKey);

		if (fkCols.length >= 2 && pkCols.length >= 2) {
			const fkNames = new Set(fkCols.map((c) => c.name.toLowerCase()));
			const pkNames = new Set(pkCols.map((c) => c.name.toLowerCase()));
			const overlap = [...fkNames].filter((n) => pkNames.has(n));

			if (overlap.length >= 2) {
				// Mark relevant relationships as junction
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

function parseTableBody(tableName: string, body: string, warnings: string[]): ParsedTable {
	const columns: ParsedColumn[] = [];
	const compositePkColumns: string[] = [];

	// Split by commas, but respect parentheses depth
	const parts = splitByComma(body);

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		const upper = trimmed.toUpperCase();

		// PRIMARY KEY (col1, col2)
		if (/^\s*PRIMARY\s+KEY\s*/i.test(trimmed)) {
			const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(\s*([\s\S]*?)\s*\)/i);
			if (pkMatch) {
				const cols = pkMatch[1].split(',').map((c) => c.trim().replace(/`|"|'|\[|\]/g, ''));
				compositePkColumns.push(...cols);
			}
			continue;
		}

		// FOREIGN KEY ... REFERENCES
		if (/^\s*(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY/i.test(trimmed)) {
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

		// UNIQUE, INDEX, KEY, CHECK, CONSTRAINT — skip
		if (/^\s*(UNIQUE|INDEX|KEY|CHECK|CONSTRAINT)\s/i.test(trimmed)) {
			continue;
		}

		// Column definition
		const colMatch = trimmed.match(
			/^(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?\s+(\w+(?:\([^)]*\))?(?:\s+\w+)*)/i
		);
		if (colMatch) {
			const colName = colMatch[1];
			const rest = colMatch[2];
			const upperRest = rest.toUpperCase();

			const isPK = /PRIMARY\s+KEY/i.test(upperRest) || /\bSERIAL\b/i.test(upperRest);

			// Inline REFERENCES
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
		}
	}

	// Apply composite PK
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
	// Get the first word(s) as data type, e.g. "INT", "VARCHAR(255)", "BIGINT UNSIGNED"
	const match = rest.match(/^(\w+(?:\([^)]*\))?(?:\s+UNSIGNED)?)/i);
	return match ? match[1].toUpperCase() : 'TEXT';
}
