import type { Entity } from '$lib/types/er';
import type { Position } from '$lib/types/geometry';

export interface LayoutOptions {
	columns: number;
	spacingX: number;
	spacingY: number;
	startX: number;
	startY: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
	columns: 3,
	spacingX: 280,
	spacingY: 250,
	startX: 60,
	startY: 60
};

export function gridLayout(entities: Entity[], options: Partial<LayoutOptions> = {}): Map<string, Position> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const positions = new Map<string, Position>();

	entities.forEach((entity, i) => {
		positions.set(entity.id, {
			x: opts.startX + (i % opts.columns) * opts.spacingX,
			y: opts.startY + Math.floor(i / opts.columns) * opts.spacingY
		});
	});

	return positions;
}
