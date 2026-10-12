import type { Entity, Relationship, Attribute, AttributeType, CardinalityType } from '$lib/types/er';
import type { FlowNode, FlowEdge, FlowNodeType } from '$lib/types/flowchart';
import { generateId } from './id';
import type { ImportedDiagramData, ImportedFlowchartData } from './import-adapter';








function sanitizeId(name: string): string {
	const cleaned = name.trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
	return cleaned || 'node';
}


function makeUniqueId(base: string, used: Set<string>): string {
	let id = base;
	let n = 2;
	while (used.has(id)) id = `${base}_${n++}`;
	used.add(id);
	return id;
}



const MERMAID_ATTR_KEY: Record<AttributeType, string> = {
	regular: '',
	primary_key: 'PK',
	foreign_key: 'FK',
	partial_key: 'PK',
	derived: '',
	multivalued: '',
	composite: ''
};


function mermaidCardinality(from: CardinalityType, to: CardinalityType): string {
	const isMany = (c: CardinalityType) => c === 'N' || c === 'M' || c === '0..N' || c === '1..N';
	const isOptional = (c: CardinalityType) => c.startsWith('0');
	
	const left = isMany(from)
		? (isOptional(from) ? '}o' : '}|')
		: (isOptional(from) ? 'o|' : '||');
	const right = isMany(to)
		? (isOptional(to) ? 'o{' : '|{')
		: (isOptional(to) ? '|o' : '||');
	return `${left}--${right}`;
}

export function erToMermaid(entities: Entity[], relationships: Relationship[]): string {
	const lines: string[] = ['erDiagram'];
	const idFor = new Map<string, string>();
	const used = new Set<string>();

	for (const e of entities) {
		const id = makeUniqueId(sanitizeId(e.name), used);
		idFor.set(e.id, id);
	}

	
	for (const e of entities) {
		const id = idFor.get(e.id)!;
		if (e.attributes.length === 0) {
			lines.push(`\t${id} {`, `\t}`);
			continue;
		}
		lines.push(`\t${id} {`);
		for (const a of e.attributes) {
			const key = MERMAID_ATTR_KEY[a.type] || '';
			const attrName = sanitizeId(a.name);
			const type = a.type === 'derived' ? 'derived' : 'string';
			lines.push(`\t\t${type} ${attrName}${key ? ' ' + key : ''}`);
		}
		lines.push(`\t}`);
	}

	
	for (const r of relationships) {
		const from = idFor.get(r.entityIds[0]);
		const to = idFor.get(r.entityIds[1]);
		if (!from || !to) continue;
		const card = mermaidCardinality(r.cardinalities[0], r.cardinalities[1]);
		const label = sanitizeId(r.name) || 'has';
		lines.push(`\t${from} ${card} ${to} : ${label}`);
	}

	return lines.join('\n');
}




function flowShapeWrap(type: FlowNodeType, label: string): string {
	const l = label.replace(/"/g, "'");
	switch (type) {
		case 'start-end':
			return `(["${l}"])`;
		case 'decision':
			return `{"${l}"}`;
		case 'input-output':
			return `[/"${l}"/]`;
		case 'database':
		case 'stored-data':
		case 'internal-storage':
			return `[("${l}")]`;
		case 'document':
			return `[/"${l}"/]`;
		case 'connector':
		case 'off-page-connector':
		case 'circle':
			return `(("${l}"))`;
		case 'preparation':
			return `{{"${l}"}}`;
		case 'predefined-process':
			return `[["${l}"]]`;
		default:
			return `["${l}"]`;
	}
}

export function flowToMermaid(nodes: FlowNode[], edges: FlowEdge[]): string {
	const lines: string[] = ['flowchart TD'];
	const idFor = new Map<string, string>();
	const used = new Set<string>();

	for (const n of nodes) {
		const id = makeUniqueId(sanitizeId(n.name || n.type), used);
		idFor.set(n.id, id);
		lines.push(`\t${id}${flowShapeWrap(n.type, n.name || '')}`);
	}

	for (const e of edges) {
		const from = idFor.get(e.fromNodeId);
		const to = idFor.get(e.toNodeId);
		if (!from || !to) continue;
		const label = e.label || (e.condition ? (e.condition === 'yes' ? 'Yes' : 'No') : '');
		if (label) {
			lines.push(`\t${from} -->|"${label.replace(/"/g, "'")}"| ${to}`);
		} else {
			lines.push(`\t${from} --> ${to}`);
		}
	}

	return lines.join('\n');
}



export type MermaidKind = 'er' | 'flowchart' | 'unknown';

export function detectMermaidKind(text: string): MermaidKind {
	const t = text.trim();
	
	const body = t.replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/i, '').trim();
	const first = body.split('\n')[0].trim().toLowerCase();
	if (first.startsWith('erdiagram')) return 'er';
	if (first.startsWith('flowchart') || first.startsWith('graph')) return 'flowchart';
	return 'unknown';
}

function stripFences(text: string): string {
	return text.trim().replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/i, '').trim();
}



const KEY_TO_ATTR: Record<string, AttributeType> = {
	PK: 'primary_key',
	FK: 'foreign_key'
};


function parseMermaidCardinality(token: string): [CardinalityType, CardinalityType] {
	
	const m = token.match(/^([|}o]{1,2})\.?.?\.?-+\.?.?\.?([|o{]{1,2})$/);
	const left = m?.[1] ?? '||';
	const right = m?.[2] ?? '||';
	const toCard = (side: string, isLeft: boolean): CardinalityType => {
		const many = side.includes('{') || side.includes('}');
		const optional = side.includes('o');
		if (many) return optional ? '0..N' : 'N';
		return optional ? '0..1' : '1';
	};
	return [toCard(left, true), toCard(right, false)];
}

export function mermaidToEr(text: string): ImportedDiagramData {
	const body = stripFences(text);
	const lines = body.split('\n').map(l => l.trim()).filter(Boolean);

	const entities: Entity[] = [];
	const relationships: Relationship[] = [];
	const idByName = new Map<string, string>();

	function ensureEntity(name: string): string {
		const key = name.toLowerCase();
		let id = idByName.get(key);
		if (!id) {
			id = generateId();
			idByName.set(key, id);
			entities.push({ id, name, attributes: [], position: { x: 0, y: 0 }, isWeak: false });
		}
		return id;
	}

	let currentEntity: Entity | null = null;

	for (const raw of lines) {
		const line = raw;
		if (/^erdiagram/i.test(line)) continue;

		
		if (line === '}') { currentEntity = null; continue; }

		
		const blockOpen = line.match(/^([A-Za-z0-9_"\- ]+?)\s*\{$/);
		if (blockOpen && !line.includes('--')) {
			const name = blockOpen[1].replace(/"/g, '').trim();
			const id = ensureEntity(name);
			currentEntity = entities.find(e => e.id === id) || null;
			continue;
		}

		
		if (currentEntity) {
			const attrMatch = line.match(/^(\S+)\s+(\S+)(?:\s+(PK|FK|UK))?/);
			if (attrMatch) {
				const attrName = attrMatch[2].replace(/"/g, '');
				const key = attrMatch[3];
				const attr: Attribute = {
					id: generateId(),
					name: attrName,
					type: key ? (KEY_TO_ATTR[key] ?? 'regular') : 'regular'
				};
				currentEntity.attributes.push(attr);
			}
			continue;
		}

		
		const relMatch = line.match(/^([A-Za-z0-9_"\- ]+?)\s+([|}o][|}o.\-]*[|o{])\s+([A-Za-z0-9_"\- ]+?)\s*:\s*(.+)$/);
		if (relMatch) {
			const fromName = relMatch[1].replace(/"/g, '').trim();
			const token = relMatch[2];
			const toName = relMatch[3].replace(/"/g, '').trim();
			const label = relMatch[4].replace(/"/g, '').trim();
			const fromId = ensureEntity(fromName);
			const toId = ensureEntity(toName);
			relationships.push({
				id: generateId(),
				name: label || 'has',
				entityIds: [fromId, toId],
				cardinalities: parseMermaidCardinality(token),
				isIdentifying: false
			});
		}
	}

	return { entities, relationships };
}




function inferFlowType(open: string): FlowNodeType {
	if (open.startsWith('([')) return 'start-end';
	if (open.startsWith('[(')) return 'database';
	if (open.startsWith('((')) return 'connector';
	if (open.startsWith('{{')) return 'preparation';
	if (open.startsWith('{')) return 'decision';
	if (open.startsWith('[[')) return 'predefined-process';
	if (open.startsWith('[/') || open.startsWith('[\\')) return 'input-output';
	return 'process';
}

const SHAPE_PATTERNS: { re: RegExp; open: string }[] = [
	{ re: /^\(\[(.+?)\]\)$/, open: '([' },
	{ re: /^\[\((.+?)\)\]$/, open: '[(' },
	{ re: /^\(\((.+?)\)\)$/, open: '((' },
	{ re: /^\{\{(.+?)\}\}$/, open: '{{' },
	{ re: /^\{(.+?)\}$/, open: '{' },
	{ re: /^\[\[(.+?)\]\]$/, open: '[[' },
	{ re: /^\[\/(.+?)\/\]$/, open: '[/' },
	{ re: /^\[\\(.+?)\\\]$/, open: '[\\' },
	{ re: /^\((.+?)\)$/, open: '(' },
	{ re: /^\[(.+?)\]$/, open: '[' }
];


function parseNodeToken(token: string): { id: string; label: string; type: FlowNodeType } | null {
	const t = token.trim();
	const idMatch = t.match(/^([A-Za-z0-9_]+)(.*)$/);
	if (!idMatch) return null;
	const id = idMatch[1];
	const rest = idMatch[2].trim();
	if (!rest) return { id, label: id, type: 'process' };
	for (const { re, open } of SHAPE_PATTERNS) {
		const m = rest.match(re);
		if (m) {
			const label = m[1].replace(/^["']|["']$/g, '');
			return { id, label, type: inferFlowType(open) };
		}
	}
	return { id, label: id, type: 'process' };
}

export function mermaidToFlow(text: string): ImportedFlowchartData {
	const body = stripFences(text);
	const lines = body.split('\n').map(l => l.trim()).filter(Boolean);

	const flowNodes: FlowNode[] = [];
	const flowEdges: FlowEdge[] = [];
	const nodeById = new Map<string, FlowNode>();

	function ensureNode(id: string, label?: string, type?: FlowNodeType): FlowNode {
		let node = nodeById.get(id);
		if (!node) {
			node = { id: generateId(), name: label ?? id, type: type ?? 'process', position: { x: 0, y: 0 } };
			nodeById.set(id, node);
			flowNodes.push(node);
		} else {
			if (label && (node.name === id || !node.name)) node.name = label;
			if (type && node.type === 'process') node.type = type;
		}
		return node;
	}

	
	const edgeRe = /^(.+?)\s*(-{2,}>|-\.-?->|==+>)\s*(?:\|"?(.+?)"?\|)?\s*(.+)$/;

	for (const line of lines) {
		if (/^(flowchart|graph)\b/i.test(line)) continue;
		if (/^(subgraph|end|classDef|class|style|linkStyle|direction)\b/i.test(line)) continue;

		const edgeMatch = line.match(edgeRe);
		if (edgeMatch) {
			const leftTok = edgeMatch[1].trim();
			const label = edgeMatch[3]?.replace(/^["']|["']$/g, '') ?? '';
			const rightTok = edgeMatch[4].trim();
			const left = parseNodeToken(leftTok);
			const right = parseNodeToken(rightTok);
			if (left && right) {
				const fromNode = ensureNode(left.id, left.label, left.type);
				const toNode = ensureNode(right.id, right.label, right.type);
				const cond = /^y(es)?$/i.test(label) ? 'yes' : /^no?$/i.test(label) ? 'no' : undefined;
				flowEdges.push({
					id: generateId(),
					label,
					fromNodeId: fromNode.id,
					toNodeId: toNode.id,
					condition: cond
				});
			}
			continue;
		}

		
		const node = parseNodeToken(line);
		if (node) ensureNode(node.id, node.label, node.type);
	}

	return { flowNodes, flowEdges };
}
