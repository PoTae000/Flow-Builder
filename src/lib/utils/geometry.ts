import type { Position, Size, ConnectionPoint, Rect } from '$lib/types/geometry';

export function getEntityRect(position: Position, attributeCount: number, entityName: string): Rect {
	const headerHeight = 40;
	const attrHeight = 24;
	const padding = 16;
	const charWidth = 8;

	const minWidth = Math.max(entityName.length * charWidth + padding * 2, 140);
	const height = headerHeight + Math.max(attributeCount, 1) * attrHeight + padding;

	return {
		x: position.x,
		y: position.y,
		width: minWidth,
		height
	};
}

export function getConnectionPoints(rect: Rect): ConnectionPoint[] {
	return [
		{ x: rect.x + rect.width / 2, y: rect.y, side: 'top' },
		{ x: rect.x + rect.width, y: rect.y + rect.height / 2, side: 'right' },
		{ x: rect.x + rect.width / 2, y: rect.y + rect.height, side: 'bottom' },
		{ x: rect.x, y: rect.y + rect.height / 2, side: 'left' }
	];
}

export function getNearestConnectionPoints(
	rectA: Rect,
	rectB: Rect
): { from: ConnectionPoint; to: ConnectionPoint } {
	const pointsA = getConnectionPoints(rectA);
	const pointsB = getConnectionPoints(rectB);

	let minDist = Infinity;
	let bestFrom = pointsA[0];
	let bestTo = pointsB[0];

	for (const pa of pointsA) {
		for (const pb of pointsB) {
			const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
			if (dist < minDist) {
				minDist = dist;
				bestFrom = pa;
				bestTo = pb;
			}
		}
	}

	return { from: bestFrom, to: bestTo };
}

export function getCenterPoint(rect: Rect): Position {
	return {
		x: rect.x + rect.width / 2,
		y: rect.y + rect.height / 2
	};
}
