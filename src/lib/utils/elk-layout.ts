import ELK from 'elkjs/lib/elk.bundled.js';
import type { Entity, Relationship } from '$lib/types/er';
import type { Position } from '$lib/types/geometry';

const elk = new ELK();

// Rotate through these every press for variety
const DIRECTIONS = ['DOWN', 'RIGHT', 'LEFT', 'UP'] as const;
const PLACEMENT_STRATEGIES = ['NETWORK_SIMPLEX', 'BRANDES_KOEPF', 'LINEAR_SEGMENTS'] as const;
let pressCount = 0;

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/**
 * Compute layout positions using ELK.js.
 * Each press cycles direction + shuffles node order for variety.
 */
export async function computeELKLayout(
	entities: Entity[],
	relationships: Relationship[],
	notation: string,
	estimateBox: (e: Entity) => { w: number; h: number }
): Promise<Map<string, Position> | null> {
	if (entities.length === 0) return null;

	const isChen = notation === 'chen';
	const press = pressCount++;

	// Shuffle entities so ELK sees different node ordering each time
	const shuffled = shuffle(entities);

	const nodes = shuffled.map((e) => {
		const box = estimateBox(e);
		const chenPad = isChen && e.attributes.length > 0 ? 80 : 0;
		return { id: e.id, width: box.w + chenPad, height: box.h + chenPad };
	});

	// Deduplicate edges, also shuffled
	const edgeSet = new Set<string>();
	const edges: { id: string; sources: string[]; targets: string[] }[] = [];
	for (const rel of shuffle(relationships)) {
		const key = [rel.entityIds[0], rel.entityIds[1]].sort().join('|');
		if (edgeSet.has(key)) continue;
		edgeSet.add(key);
		edges.push({ id: rel.id, sources: [rel.entityIds[0]], targets: [rel.entityIds[1]] });
	}

	const n = entities.length;
	const dir = DIRECTIONS[press % DIRECTIONS.length];
	const placement = PLACEMENT_STRATEGIES[press % PLACEMENT_STRATEGIES.length];
	const nodeSpacing = isChen ? 250 : Math.max(120, 80 + n * 3);
	const layerSpacing = isChen ? 280 : Math.max(200, 150 + n * 4);
	const seed = Math.floor(Math.random() * 999999);

	const graph = {
		id: 'root',
		layoutOptions: {
			'elk.algorithm': 'layered',
			'elk.direction': dir,
			'elk.randomSeed': String(seed),
			'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
			'elk.spacing.nodeNode': String(nodeSpacing),
			'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
			'elk.edgeRouting': 'ORTHOGONAL',
			'elk.layered.nodePlacement.strategy': placement,
			'elk.layered.thoroughness': n > 10 ? '30' : '7'
		},
		children: nodes,
		edges
	};

	const result = await elk.layout(graph);
	if (!result.children) return null;

	let minX = Infinity, minY = Infinity;
	for (const child of result.children) {
		if (child.x != null && child.y != null) {
			minX = Math.min(minX, child.x);
			minY = Math.min(minY, child.y);
		}
	}

	const positions = new Map<string, Position>();
	for (const child of result.children) {
		if (child.x != null && child.y != null) {
			positions.set(child.id, {
				x: Math.round(child.x - minX + 60),
				y: Math.round(child.y - minY + 60)
			});
		}
	}

	return positions;
}
