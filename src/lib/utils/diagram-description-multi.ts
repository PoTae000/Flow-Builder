import type { Entity, Relationship } from '$lib/types/er';
import type { FlowNode, FlowEdge } from '$lib/types/flowchart';
import type { DFDNode, DFDFlow } from '$lib/types/context-diagram';
import type { DiagramType } from '$lib/types/diagram';


export function buildERDescription(entities: Entity[], relationships: Relationship[]): string {
	let text = '## Entities\n\n';
	for (const e of entities) {
		text += `### ${e.name}\n`;
		if (e.attributes.length === 0) {
			text += '- (no attributes)\n';
		} else {
			for (const a of e.attributes) {
				const typeStr = a.type === 'primary_key' ? ' [PK]' :
					a.type === 'foreign_key' ? ' [FK]' :
					a.type === 'derived' ? ' [DERIVED]' :
					a.type === 'multivalued' ? ' [MULTIVALUED]' :
					a.type === 'partial_key' ? ' [PARTIAL KEY]' :
					a.type === 'composite' ? ' [COMPOSITE]' : '';
				text += `- ${a.name}${typeStr}\n`;
			}
		}
		text += '\n';
	}

	text += '## Relationships\n\n';
	if (relationships.length === 0) {
		text += '(no relationships)\n';
	} else {
		for (const r of relationships) {
			const fromEntity = entities.find(e => e.id === r.entityIds[0])?.name || 'Unknown';
			const toEntity = entities.find(e => e.id === r.entityIds[1])?.name || 'Unknown';
			text += `- ${fromEntity} [${r.cardinalities[0]}] → "${r.name || 'unnamed'}" → [${r.cardinalities[1]}] ${toEntity}\n`;
		}
	}

	return text;
}


export function buildFlowchartDescription(nodes: FlowNode[], edges: FlowEdge[]): string {
	let text = '## Flowchart Nodes\n\n';

	
	const nodesByType = new Map<string, FlowNode[]>();
	for (const node of nodes) {
		if (!nodesByType.has(node.type)) {
			nodesByType.set(node.type, []);
		}
		nodesByType.get(node.type)!.push(node);
	}

	
	for (const [type, typeNodes] of nodesByType) {
		text += `### ${type}\n`;
		for (const node of typeNodes) {
			text += `- ${node.name}\n`;
		}
		text += '\n';
	}

	text += '## Flowchart Connections\n\n';
	if (edges.length === 0) {
		text += '(no connections)\n';
	} else {
		for (const edge of edges) {
			const fromNode = nodes.find(n => n.id === edge.fromNodeId);
			const toNode = nodes.find(n => n.id === edge.toNodeId);
			const fromName = fromNode?.name || 'Unknown';
			const toName = toNode?.name || 'Unknown';

			const conditionStr = edge.condition ? ` [${edge.condition}]` : '';
			const labelStr = edge.label ? ` "${edge.label}"` : '';

			text += `- ${fromName} →${labelStr}${conditionStr} → ${toName}\n`;
		}
	}

	return text;
}


export function buildDFDDescription(nodes: DFDNode[], flows: DFDFlow[]): string {
	let text = '## DFD Nodes\n\n';

	
	const processes: DFDNode[] = [];
	const externalEntities: DFDNode[] = [];
	const dataStores: DFDNode[] = [];

	for (const node of nodes) {
		if (node.type === 'process') {
			processes.push(node);
		} else if (node.type === 'external-entity') {
			externalEntities.push(node);
		} else if (node.type === 'data-store') {
			dataStores.push(node);
		}
	}

	
	text += '### Processes\n';
	if (processes.length === 0) {
		text += '(no processes)\n';
	} else {
		for (const p of processes) {
			const numberStr = p.processNumber ? `${p.processNumber} - ` : '';
			text += `- ${numberStr}${p.name}\n`;
		}
	}
	text += '\n';

	
	text += '### External Entities\n';
	if (externalEntities.length === 0) {
		text += '(no external entities)\n';
	} else {
		for (const e of externalEntities) {
			text += `- ${e.name}\n`;
		}
	}
	text += '\n';

	
	text += '### Data Stores\n';
	if (dataStores.length === 0) {
		text += '(no data stores)\n';
	} else {
		for (const s of dataStores) {
			text += `- ${s.name}\n`;
		}
	}
	text += '\n';

	
	text += '## Data Flows\n\n';
	if (flows.length === 0) {
		text += '(no data flows)\n';
	} else {
		for (const flow of flows) {
			const fromNode = nodes.find(n => n.id === flow.fromNodeId);
			const toNode = nodes.find(n => n.id === flow.toNodeId);
			const fromName = fromNode?.name || 'Unknown';
			const toName = toNode?.name || 'Unknown';
			const labelStr = flow.label ? `"${flow.label}"` : '(unlabeled)';

			text += `- ${fromName} → ${labelStr} → ${toName}\n`;
		}
	}

	return text;
}


export function buildUnifiedDiagramDescription(
	diagramType: DiagramType,
	data: {
		entities?: Entity[];
		relationships?: Relationship[];
		flowNodes?: FlowNode[];
		flowEdges?: FlowEdge[];
		dfdNodes?: DFDNode[];
		dfdFlows?: DFDFlow[];
	}
): string {
	if (diagramType === 'er') {
		return buildERDescription(data.entities || [], data.relationships || []);
	} else if (diagramType === 'flowchart') {
		return buildFlowchartDescription(data.flowNodes || [], data.flowEdges || []);
	} else if (diagramType === 'context') {
		return buildDFDDescription(data.dfdNodes || [], data.dfdFlows || []);
	}

	return '(unknown diagram type)';
}
