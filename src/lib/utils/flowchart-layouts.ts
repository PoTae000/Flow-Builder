import type { FlowNode, FlowEdge } from '$lib/types/flowchart';
import type { Position } from '$lib/types/geometry';

export type LayoutType = 'hierarchical-tb' | 'hierarchical-lr' | 'grid' | 'circular' | 'force';

interface LayoutResult {
	positions: Map<string, Position>;
}


function calculateNodeLevels(nodes: FlowNode[], edges: FlowEdge[]): Map<string, number> {
	const levels = new Map<string, number>();
	const inDegree = new Map<string, number>();
	const outDegree = new Map<string, number>();

	
	for (const node of nodes) {
		inDegree.set(node.id, 0);
		outDegree.set(node.id, 0);
	}

	
	for (const edge of edges) {
		inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) || 0) + 1);
		outDegree.set(edge.fromNodeId, (outDegree.get(edge.fromNodeId) || 0) + 1);
	}

	
	const startNodes: string[] = [];
	for (const node of nodes) {
		if (inDegree.get(node.id) === 0 || node.type === 'start-end') {
			startNodes.push(node.id);
			levels.set(node.id, 0);
		}
	}

	
	const queue = [...startNodes];
	const visited = new Set<string>(startNodes);

	while (queue.length > 0) {
		const nodeId = queue.shift()!;
		const currentLevel = levels.get(nodeId) || 0;

		
		for (const edge of edges) {
			if (edge.fromNodeId === nodeId) {
				const childId = edge.toNodeId;
				const childCurrentLevel = levels.get(childId) ?? -1;
				const newLevel = currentLevel + 1;

				
				if (newLevel > childCurrentLevel) {
					levels.set(childId, newLevel);
				}

				if (!visited.has(childId)) {
					visited.add(childId);
					queue.push(childId);
				}
			}
		}
	}

	
	for (const node of nodes) {
		if (!levels.has(node.id)) {
			levels.set(node.id, 0);
		}
	}

	return levels;
}


export function layoutHierarchicalTB(nodes: FlowNode[], edges: FlowEdge[]): LayoutResult {
	const positions = new Map<string, Position>();
	if (nodes.length === 0) return { positions };

	const levels = calculateNodeLevels(nodes, edges);
	const nodesByLevel = new Map<number, FlowNode[]>();

	
	for (const node of nodes) {
		const level = levels.get(node.id) || 0;
		if (!nodesByLevel.has(level)) {
			nodesByLevel.set(level, []);
		}
		nodesByLevel.get(level)!.push(node);
	}

	
	const LEVEL_HEIGHT = 180;
	const NODE_SPACING = 200;
	const START_Y = 100;

	
	const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);

	for (const level of sortedLevels) {
		const levelNodes = nodesByLevel.get(level)!;
		const y = START_Y + level * LEVEL_HEIGHT;

		
		const totalWidth = levelNodes.length * NODE_SPACING;
		const startX = -totalWidth / 2;

		levelNodes.forEach((node, i) => {
			positions.set(node.id, {
				x: startX + i * NODE_SPACING + NODE_SPACING / 2,
				y
			});
		});
	}

	return { positions };
}


export function layoutHierarchicalLR(nodes: FlowNode[], edges: FlowEdge[]): LayoutResult {
	const positions = new Map<string, Position>();
	if (nodes.length === 0) return { positions };

	const levels = calculateNodeLevels(nodes, edges);
	const nodesByLevel = new Map<number, FlowNode[]>();

	
	for (const node of nodes) {
		const level = levels.get(node.id) || 0;
		if (!nodesByLevel.has(level)) {
			nodesByLevel.set(level, []);
		}
		nodesByLevel.get(level)!.push(node);
	}

	
	const LEVEL_WIDTH = 250;
	const NODE_SPACING = 150;
	const START_X = 100;

	
	const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);

	for (const level of sortedLevels) {
		const levelNodes = nodesByLevel.get(level)!;
		const x = START_X + level * LEVEL_WIDTH;

		
		const totalHeight = levelNodes.length * NODE_SPACING;
		const startY = -totalHeight / 2;

		levelNodes.forEach((node, i) => {
			positions.set(node.id, {
				x,
				y: startY + i * NODE_SPACING + NODE_SPACING / 2
			});
		});
	}

	return { positions };
}


export function layoutGrid(nodes: FlowNode[], edges: FlowEdge[]): LayoutResult {
	const positions = new Map<string, Position>();
	if (nodes.length === 0) return { positions };

	const cols = Math.ceil(Math.sqrt(nodes.length));
	const CELL_WIDTH = 220;
	const CELL_HEIGHT = 150;

	nodes.forEach((node, i) => {
		const row = Math.floor(i / cols);
		const col = i % cols;

		positions.set(node.id, {
			x: col * CELL_WIDTH - ((cols - 1) * CELL_WIDTH) / 2,
			y: row * CELL_HEIGHT - (Math.ceil(nodes.length / cols - 1) * CELL_HEIGHT) / 2
		});
	});

	return { positions };
}


export function layoutCircular(nodes: FlowNode[], edges: FlowEdge[]): LayoutResult {
	const positions = new Map<string, Position>();
	if (nodes.length === 0) return { positions };

	const radius = Math.max(300, nodes.length * 40);
	const angleStep = (2 * Math.PI) / nodes.length;

	nodes.forEach((node, i) => {
		const angle = i * angleStep - Math.PI / 2; 

		positions.set(node.id, {
			x: Math.cos(angle) * radius,
			y: Math.sin(angle) * radius
		});
	});

	return { positions };
}


export function layoutForce(nodes: FlowNode[], edges: FlowEdge[]): LayoutResult {
	const positions = new Map<string, Position>();
	if (nodes.length === 0) return { positions };

	
	const nodeData = new Map<string, { x: number; y: number; vx: number; vy: number }>();
	nodes.forEach((node) => {
		nodeData.set(node.id, {
			x: (Math.random() - 0.5) * 400,
			y: (Math.random() - 0.5) * 400,
			vx: 0,
			vy: 0
		});
	});

	
	const ITERATIONS = 100;
	const REPULSION = 50000;
	const ATTRACTION = 0.01;
	const DAMPING = 0.85;

	
	for (let iter = 0; iter < ITERATIONS; iter++) {
		
		for (const node1 of nodes) {
			const data1 = nodeData.get(node1.id)!;

			for (const node2 of nodes) {
				if (node1.id === node2.id) continue;
				const data2 = nodeData.get(node2.id)!;

				const dx = data1.x - data2.x;
				const dy = data1.y - data2.y;
				const distSq = dx * dx + dy * dy + 1; 
				const force = REPULSION / distSq;

				data1.vx += (dx / Math.sqrt(distSq)) * force;
				data1.vy += (dy / Math.sqrt(distSq)) * force;
			}
		}

		
		for (const edge of edges) {
			const data1 = nodeData.get(edge.fromNodeId);
			const data2 = nodeData.get(edge.toNodeId);
			if (!data1 || !data2) continue;

			const dx = data2.x - data1.x;
			const dy = data2.y - data1.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			const force = dist * ATTRACTION;

			data1.vx += (dx / dist) * force;
			data1.vy += (dy / dist) * force;
			data2.vx -= (dx / dist) * force;
			data2.vy -= (dy / dist) * force;
		}

		
		for (const [id, data] of nodeData) {
			data.x += data.vx;
			data.y += data.vy;
			data.vx *= DAMPING;
			data.vy *= DAMPING;
		}
	}

	
	for (const [id, data] of nodeData) {
		positions.set(id, { x: data.x, y: data.y });
	}

	return { positions };
}


export function applyLayout(
	layoutType: LayoutType,
	nodes: FlowNode[],
	edges: FlowEdge[]
): LayoutResult {
	switch (layoutType) {
		case 'hierarchical-tb':
			return layoutHierarchicalTB(nodes, edges);
		case 'hierarchical-lr':
			return layoutHierarchicalLR(nodes, edges);
		case 'grid':
			return layoutGrid(nodes, edges);
		case 'circular':
			return layoutCircular(nodes, edges);
		case 'force':
			return layoutForce(nodes, edges);
		default:
			return { positions: new Map() };
	}
}
