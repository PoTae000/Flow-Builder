import type { Entity, Relationship } from '$lib/types/er';
import type { FlowNode, FlowEdge } from '$lib/types/flowchart';
import type { DFDNode, DFDFlow } from '$lib/types/context-diagram';

// ER Diagram markdown generation (existing function, renamed for clarity)
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

// Flowchart markdown generation
export function generateFlowchartMarkdown(nodes: FlowNode[], edges: FlowEdge[]): string {
	const lines: string[] = [];
	const today = new Date().toISOString().slice(0, 10);

	lines.push('# Flowchart Documentation');
	lines.push('');
	lines.push(`Generated: ${today}`);
	lines.push('');

	// --- Nodes ---
	lines.push('## Nodes');
	lines.push('');

	if (nodes.length === 0) {
		lines.push('_No nodes defined._');
		lines.push('');
	} else {
		// Group nodes by type
		const nodesByType = new Map<string, FlowNode[]>();
		for (const node of nodes) {
			const existing = nodesByType.get(node.type) || [];
			existing.push(node);
			nodesByType.set(node.type, existing);
		}

		// Display nodes grouped by type
		const typeOrder = ['start-end', 'process', 'decision', 'input-output', 'connector', 'document', 'database', 'predefined-process', 'manual-operation', 'preparation', 'delay', 'display', 'internal-storage'];

		for (const type of typeOrder) {
			const nodesOfType = nodesByType.get(type);
			if (!nodesOfType || nodesOfType.length === 0) continue;

			const typeLabel = formatFlowNodeType(type);
			lines.push(`### ${typeLabel}`);
			lines.push('');

			for (const node of nodesOfType) {
				lines.push(`- **${node.name}**`);
			}
			lines.push('');
		}
	}

	// --- Connections ---
	lines.push('## Connections');
	lines.push('');

	if (edges.length === 0) {
		lines.push('_No connections defined._');
		lines.push('');
	} else {
		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		for (const edge of edges) {
			const fromNode = nodeMap.get(edge.fromNodeId);
			const toNode = nodeMap.get(edge.toNodeId);

			if (!fromNode || !toNode) continue;

			let connection = `- ${fromNode.name} → ${toNode.name}`;

			// Add label or condition if present
			if (edge.condition) {
				connection += ` *(${edge.condition === 'yes' ? 'Yes' : 'No'})*`;
			} else if (edge.label) {
				connection += ` *[${edge.label}]*`;
			}

			lines.push(connection);
		}

		lines.push('');
	}

	// --- Summary ---
	lines.push('## Summary');
	lines.push('');
	lines.push(`- **Total Nodes:** ${nodes.length}`);

	// Count by type
	const typeCounts = new Map<string, number>();
	for (const node of nodes) {
		typeCounts.set(node.type, (typeCounts.get(node.type) || 0) + 1);
	}

	for (const [type, count] of typeCounts.entries()) {
		lines.push(`- **${formatFlowNodeType(type)}:** ${count}`);
	}

	lines.push(`- **Total Connections:** ${edges.length}`);
	lines.push('');

	return lines.join('\n');
}

// DFD/Context Diagram markdown generation
export function generateDFDMarkdown(nodes: DFDNode[], flows: DFDFlow[]): string {
	const lines: string[] = [];
	const today = new Date().toISOString().slice(0, 10);

	lines.push('# Data Flow Diagram Documentation');
	lines.push('');
	lines.push(`Generated: ${today}`);
	lines.push('');

	// --- Group nodes by type ---
	const processes: DFDNode[] = [];
	const externalEntities: DFDNode[] = [];
	const dataStores: DFDNode[] = [];

	for (const node of nodes) {
		if (node.type === 'process') processes.push(node);
		else if (node.type === 'external-entity') externalEntities.push(node);
		else if (node.type === 'data-store') dataStores.push(node);
	}

	// --- Processes ---
	lines.push('## Processes');
	lines.push('');

	if (processes.length === 0) {
		lines.push('_No processes defined._');
		lines.push('');
	} else {
		for (const proc of processes) {
			const displayName = proc.processNumber ? `${proc.processNumber} - ${proc.name}` : proc.name;
			lines.push(`- **${displayName}**`);
		}
		lines.push('');
	}

	// --- External Entities ---
	lines.push('## External Entities');
	lines.push('');

	if (externalEntities.length === 0) {
		lines.push('_No external entities defined._');
		lines.push('');
	} else {
		for (const entity of externalEntities) {
			lines.push(`- **${entity.name}**`);
		}
		lines.push('');
	}

	// --- Data Stores ---
	lines.push('## Data Stores');
	lines.push('');

	if (dataStores.length === 0) {
		lines.push('_No data stores defined._');
		lines.push('');
	} else {
		for (const store of dataStores) {
			lines.push(`- **${store.name}**`);
		}
		lines.push('');
	}

	// --- Data Flows ---
	lines.push('## Data Flows');
	lines.push('');

	if (flows.length === 0) {
		lines.push('_No data flows defined._');
		lines.push('');
	} else {
		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		for (const flow of flows) {
			const fromNode = nodeMap.get(flow.fromNodeId);
			const toNode = nodeMap.get(flow.toNodeId);

			if (!fromNode || !toNode) continue;

			const flowLabel = flow.label ? `"${flow.label}"` : '(unlabeled)';
			lines.push(`- ${fromNode.name} → ${flowLabel} → ${toNode.name}`);
		}

		lines.push('');
	}

	// --- Summary ---
	lines.push('## Summary');
	lines.push('');
	lines.push(`- **Processes:** ${processes.length}`);
	lines.push(`- **External Entities:** ${externalEntities.length}`);
	lines.push(`- **Data Stores:** ${dataStores.length}`);
	lines.push(`- **Data Flows:** ${flows.length}`);
	lines.push('');

	return lines.join('\n');
}

function formatFlowNodeType(type: string): string {
	switch (type) {
		case 'start-end': return 'Start/End';
		case 'process': return 'Process';
		case 'decision': return 'Decision';
		case 'input-output': return 'Input/Output';
		case 'connector': return 'Connector';
		case 'document': return 'Document';
		case 'database': return 'Database';
		case 'predefined-process': return 'Predefined Process';
		case 'manual-operation': return 'Manual Operation';
		case 'preparation': return 'Preparation';
		case 'delay': return 'Delay';
		case 'display': return 'Display';
		case 'internal-storage': return 'Internal Storage';
		default: return type;
	}
}
