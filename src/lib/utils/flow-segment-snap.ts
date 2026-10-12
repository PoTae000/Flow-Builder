import type { Position } from '$lib/types/geometry';

export function snapFlowSegment(raw: number, axis: 'x' | 'y', span: [number, number], routes: Position[][], threshold: number): number | null {
	let best: number | null = null;
	let distance = threshold;
	const other = axis === 'x' ? 'y' : 'x';
	const lo = Math.min(...span), hi = Math.max(...span);
	for (const route of routes) {
		for (let i = 1; i < route.length; i++) {
			const a = route[i - 1], b = route[i];
			if (Math.abs(a[axis] - b[axis]) > 0.01) continue;
			if (Math.max(a[other], b[other]) < lo || Math.min(a[other], b[other]) > hi) continue;
			const delta = Math.abs(a[axis] - raw);
			if (delta <= distance) { best = a[axis]; distance = delta; }
		}
	}
	return best;
}
