export interface ParsedTable {
	name: string;
	alias?: string;
}

export interface ParsedJoin {
	type: string;
	table: ParsedTable;
	onLeft: { table: string; column: string };
	onRight: { table: string; column: string };
}

export interface ParsedColumn {
	table?: string;
	column: string;
}

export interface ParsedQuery {
	tables: ParsedTable[];
	joins: ParsedJoin[];
	selectedColumns: ParsedColumn[];
	whereColumns: ParsedColumn[];
	errors: string[];
}

/**
 * Client-side regex SQL SELECT parser.
 * No external libs — extracts tables, joins, columns from SELECT statements.
 */
export function parseSqlQuery(sql: string): ParsedQuery {
	const errors: string[] = [];
	const tables: ParsedTable[] = [];
	const joins: ParsedJoin[] = [];
	const selectedColumns: ParsedColumn[] = [];
	const whereColumns: ParsedColumn[] = [];

	// Normalize: remove comments and collapse whitespace
	let normalized = sql
		.replace(/--[^\n]*/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\s+/g, ' ')
		.trim();

	if (!normalized) {
		errors.push('Empty query');
		return { tables, joins, selectedColumns, whereColumns, errors };
	}

	// Check it's a SELECT
	if (!/^\s*SELECT\b/i.test(normalized)) {
		errors.push('Only SELECT statements are supported');
		return { tables, joins, selectedColumns, whereColumns, errors };
	}

	// Build alias map for resolving
	const aliasMap = new Map<string, string>(); // alias → table name

	// Extract FROM tables (between FROM and first JOIN/WHERE/GROUP/ORDER/LIMIT/HAVING/UNION or end)
	const fromMatch = normalized.match(/\bFROM\s+([\s\S]+?)(?=\b(?:LEFT|RIGHT|INNER|FULL|CROSS|OUTER|JOIN|WHERE|GROUP|ORDER|LIMIT|HAVING|UNION)\b|$)/i);
	if (fromMatch) {
		const fromClause = fromMatch[1].trim();
		const tableEntries = fromClause.split(',');
		for (const entry of tableEntries) {
			const parsed = parseTableRef(entry.trim());
			if (parsed) {
				tables.push(parsed);
				if (parsed.alias) aliasMap.set(parsed.alias.toLowerCase(), parsed.name);
			}
		}
	} else {
		errors.push('No FROM clause found');
	}

	// Extract JOINs
	const joinRegex = /\b(LEFT|RIGHT|INNER|FULL|CROSS)?\s*(?:OUTER\s+)?JOIN\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?\s+ON\s+([\s\S]+?)(?=\b(?:LEFT|RIGHT|INNER|FULL|CROSS|JOIN|WHERE|GROUP|ORDER|LIMIT|HAVING|UNION)\b|$)/gi;
	let joinMatch;
	while ((joinMatch = joinRegex.exec(normalized)) !== null) {
		const joinType = (joinMatch[1] || 'INNER').toUpperCase();
		const tableName = joinMatch[2];
		const tableAlias = joinMatch[3];
		const onClause = joinMatch[4].trim();

		const joinTable: ParsedTable = { name: tableName };
		if (tableAlias) {
			joinTable.alias = tableAlias;
			aliasMap.set(tableAlias.toLowerCase(), tableName);
		}

		tables.push(joinTable);

		// Parse ON clause: table.col = table.col
		const onParts = onClause.match(/(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/);
		if (onParts) {
			joins.push({
				type: joinType,
				table: joinTable,
				onLeft: { table: onParts[1], column: onParts[2] },
				onRight: { table: onParts[3], column: onParts[4] }
			});
		}
	}

	// Extract SELECT columns (between SELECT and FROM)
	const selectMatch = normalized.match(/\bSELECT\s+([\s\S]+?)\bFROM\b/i);
	if (selectMatch) {
		const selectClause = selectMatch[1].trim();
		if (selectClause !== '*') {
			const cols = splitColumns(selectClause);
			for (const col of cols) {
				const parsed = parseColumnRef(col.trim());
				if (parsed) selectedColumns.push(parsed);
			}
		}
	}

	// Extract WHERE columns
	const whereMatch = normalized.match(/\bWHERE\s+([\s\S]+?)(?=\b(?:GROUP|ORDER|LIMIT|HAVING|UNION)\b|$)/i);
	if (whereMatch) {
		const whereClause = whereMatch[1];
		// Find table.column patterns
		const colPattern = /(\w+)\.(\w+)/g;
		let colMatch;
		while ((colMatch = colPattern.exec(whereClause)) !== null) {
			whereColumns.push({ table: colMatch[1], column: colMatch[2] });
		}
	}

	// Resolve aliases in columns
	resolveAliases(selectedColumns, aliasMap);
	resolveAliases(whereColumns, aliasMap);

	// Resolve aliases in joins
	for (const join of joins) {
		const leftResolved = aliasMap.get(join.onLeft.table.toLowerCase());
		if (leftResolved) join.onLeft.table = leftResolved;
		const rightResolved = aliasMap.get(join.onRight.table.toLowerCase());
		if (rightResolved) join.onRight.table = rightResolved;
	}

	return { tables, joins, selectedColumns, whereColumns, errors };
}

function parseTableRef(str: string): ParsedTable | null {
	if (!str) return null;
	// Remove surrounding parentheses (subquery)
	if (str.startsWith('(')) return null;

	const parts = str.match(/^(\w+)(?:\s+(?:AS\s+)?(\w+))?$/i);
	if (!parts) return null;

	const result: ParsedTable = { name: parts[1] };
	if (parts[2]) result.alias = parts[2];
	return result;
}

function parseColumnRef(str: string): ParsedColumn | null {
	// Remove alias: "expr AS alias" → "expr"
	const withoutAlias = str.replace(/\s+AS\s+\w+$/i, '').trim();
	// Remove function wrappers: COUNT(x) → x
	const unwrapped = withoutAlias.replace(/^\w+\(([^)]*)\)$/i, '$1').trim();

	if (unwrapped === '*') return null;

	const dotMatch = unwrapped.match(/^(\w+)\.(\w+)$/);
	if (dotMatch) {
		return { table: dotMatch[1], column: dotMatch[2] };
	}

	// Just a column name
	if (/^\w+$/.test(unwrapped)) {
		return { column: unwrapped };
	}

	return null;
}

function splitColumns(str: string): string[] {
	const result: string[] = [];
	let depth = 0;
	let current = '';
	for (const ch of str) {
		if (ch === '(') depth++;
		else if (ch === ')') depth--;
		else if (ch === ',' && depth === 0) {
			result.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	if (current.trim()) result.push(current);
	return result;
}

function resolveAliases(columns: ParsedColumn[], aliasMap: Map<string, string>) {
	for (const col of columns) {
		if (col.table) {
			const resolved = aliasMap.get(col.table.toLowerCase());
			if (resolved) col.table = resolved;
		}
	}
}
