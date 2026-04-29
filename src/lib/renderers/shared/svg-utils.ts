import type { ConnectionPoint } from '$lib/types/geometry';

/** Create an orthogonal (right-angle) path between two points */
export function createOrthogonalPath(from: ConnectionPoint, to: ConnectionPoint): string {
	const { x: x1, y: y1, side: s1 } = from;
	const { x: x2, y: y2, side: s2 } = to;

	const gap = 30; // min distance from entity before turning

	// Determine intermediate points based on which sides we're connecting
	if (s1 === 'right' && s2 === 'left') {
		const midX = (x1 + x2) / 2;
		if (x2 - x1 > gap * 2) {
			return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
		}
		// Not enough horizontal space - go around
		const outX1 = x1 + gap;
		const outX2 = x2 - gap;
		const midY = (y1 + y2) / 2;
		return `M ${x1} ${y1} L ${outX1} ${y1} L ${outX1} ${midY} L ${outX2} ${midY} L ${outX2} ${y2} L ${x2} ${y2}`;
	}

	if (s1 === 'left' && s2 === 'right') {
		const midX = (x1 + x2) / 2;
		if (x1 - x2 > gap * 2) {
			return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
		}
		const outX1 = x1 - gap;
		const outX2 = x2 + gap;
		const midY = (y1 + y2) / 2;
		return `M ${x1} ${y1} L ${outX1} ${y1} L ${outX1} ${midY} L ${outX2} ${midY} L ${outX2} ${y2} L ${x2} ${y2}`;
	}

	if (s1 === 'bottom' && s2 === 'top') {
		const midY = (y1 + y2) / 2;
		if (y2 - y1 > gap * 2) {
			return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
		}
		const outY1 = y1 + gap;
		const outY2 = y2 - gap;
		const midX = (x1 + x2) / 2;
		return `M ${x1} ${y1} L ${x1} ${outY1} L ${midX} ${outY1} L ${midX} ${outY2} L ${x2} ${outY2} L ${x2} ${y2}`;
	}

	if (s1 === 'top' && s2 === 'bottom') {
		const midY = (y1 + y2) / 2;
		if (y1 - y2 > gap * 2) {
			return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
		}
		const outY1 = y1 - gap;
		const outY2 = y2 + gap;
		const midX = (x1 + x2) / 2;
		return `M ${x1} ${y1} L ${x1} ${outY1} L ${midX} ${outY1} L ${midX} ${outY2} L ${x2} ${outY2} L ${x2} ${y2}`;
	}

	// Same-side connections or mixed
	if ((s1 === 'right' && s2 === 'right') || (s1 === 'left' && s2 === 'left')) {
		const dir = s1 === 'right' ? 1 : -1;
		const outX = Math.max(x1, x2) * dir > 0 ? Math.max(x1, x2) + gap : Math.min(x1, x2) - gap;
		const extX = (s1 === 'right' ? Math.max(x1, x2) : Math.min(x1, x2)) + gap * dir;
		return `M ${x1} ${y1} L ${extX} ${y1} L ${extX} ${y2} L ${x2} ${y2}`;
	}

	if ((s1 === 'top' && s2 === 'top') || (s1 === 'bottom' && s2 === 'bottom')) {
		const dir = s1 === 'bottom' ? 1 : -1;
		const extY = (s1 === 'bottom' ? Math.max(y1, y2) : Math.min(y1, y2)) + gap * dir;
		return `M ${x1} ${y1} L ${x1} ${extY} L ${x2} ${extY} L ${x2} ${y2}`;
	}

	// Perpendicular sides (e.g. right-top, right-bottom, etc.)
	if ((s1 === 'right' || s1 === 'left') && (s2 === 'top' || s2 === 'bottom')) {
		return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
	}

	if ((s1 === 'top' || s1 === 'bottom') && (s2 === 'right' || s2 === 'left')) {
		return `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
	}

	// Fallback: L-shaped
	return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
}

export function createStraightPath(from: ConnectionPoint, to: ConnectionPoint): string {
	return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

// Crow's foot symbols - drawn outward from entity edge
// Slot 1 (closest to entity): fork for "many" OR bar for "one"
// Slot 2 (further from entity): bar for "mandatory" OR circle for "optional"

const FORK_DEPTH = 10;  // how far fork converges from entity edge
const FORK_SPREAD = 6;  // how wide the fork prongs spread
const INNER_BAR = 4;    // slot 1 bar offset from entity edge
const OUTER_BAR = 14;   // slot 2 bar offset from entity edge
const CIRCLE_POS = 16;  // slot 2 circle offset from entity edge
const BAR_HALF = 6;     // half-length of a bar line

/** Slot 1: crow's foot fork for "many" - opens TOWARD entity, converges outward */
export function crowsFootFork(point: ConnectionPoint): string {
	const { x, y, side } = point;
	// Prongs touch entity edge, convergence point is outward on the line
	switch (side) {
		case 'left':
			return `M ${x - FORK_DEPTH} ${y} L ${x} ${y - FORK_SPREAD} M ${x - FORK_DEPTH} ${y} L ${x} ${y + FORK_SPREAD}`;
		case 'right':
			return `M ${x + FORK_DEPTH} ${y} L ${x} ${y - FORK_SPREAD} M ${x + FORK_DEPTH} ${y} L ${x} ${y + FORK_SPREAD}`;
		case 'top':
			return `M ${x} ${y - FORK_DEPTH} L ${x - FORK_SPREAD} ${y} M ${x} ${y - FORK_DEPTH} L ${x + FORK_SPREAD} ${y}`;
		case 'bottom':
			return `M ${x} ${y + FORK_DEPTH} L ${x - FORK_SPREAD} ${y} M ${x} ${y + FORK_DEPTH} L ${x + FORK_SPREAD} ${y}`;
	}
}

/** Slot 1: single bar for "one" (close to entity) */
export function crowsFootInnerBar(point: ConnectionPoint): string {
	const { x, y, side } = point;
	switch (side) {
		case 'left':
			return `M ${x - INNER_BAR} ${y - BAR_HALF} L ${x - INNER_BAR} ${y + BAR_HALF}`;
		case 'right':
			return `M ${x + INNER_BAR} ${y - BAR_HALF} L ${x + INNER_BAR} ${y + BAR_HALF}`;
		case 'top':
			return `M ${x - BAR_HALF} ${y - INNER_BAR} L ${x + BAR_HALF} ${y - INNER_BAR}`;
		case 'bottom':
			return `M ${x - BAR_HALF} ${y + INNER_BAR} L ${x + BAR_HALF} ${y + INNER_BAR}`;
	}
}

/** Slot 2: single bar for "mandatory" (further from entity) */
export function crowsFootOuterBar(point: ConnectionPoint): string {
	const { x, y, side } = point;
	switch (side) {
		case 'left':
			return `M ${x - OUTER_BAR} ${y - BAR_HALF} L ${x - OUTER_BAR} ${y + BAR_HALF}`;
		case 'right':
			return `M ${x + OUTER_BAR} ${y - BAR_HALF} L ${x + OUTER_BAR} ${y + BAR_HALF}`;
		case 'top':
			return `M ${x - BAR_HALF} ${y - OUTER_BAR} L ${x + BAR_HALF} ${y - OUTER_BAR}`;
		case 'bottom':
			return `M ${x - BAR_HALF} ${y + OUTER_BAR} L ${x + BAR_HALF} ${y + OUTER_BAR}`;
	}
}

/** Slot 2: circle for "optional" (further from entity) */
export function crowsFootCircle(point: ConnectionPoint, radius: number = 4): { cx: number; cy: number; r: number } {
	const { x, y, side } = point;
	switch (side) {
		case 'left':
			return { cx: x - CIRCLE_POS, cy: y, r: radius };
		case 'right':
			return { cx: x + CIRCLE_POS, cy: y, r: radius };
		case 'top':
			return { cx: x, cy: y - CIRCLE_POS, r: radius };
		case 'bottom':
			return { cx: x, cy: y + CIRCLE_POS, r: radius };
	}
}

/** Diamond path for Chen notation */
export function createDiamond(cx: number, cy: number, width: number, height: number): string {
	return `M ${cx} ${cy - height / 2} L ${cx + width / 2} ${cy} L ${cx} ${cy + height / 2} L ${cx - width / 2} ${cy} Z`;
}

/** Oval/ellipse for Chen attributes */
export function createOval(cx: number, cy: number, rx: number, ry: number): string {
	return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

/** Get the true midpoint along an orthogonal path for label placement */
export function getOrthogonalMidpoint(from: ConnectionPoint, to: ConnectionPoint): { x: number; y: number } {
	// Build the actual path and find the point at 50% of total length
	const pathStr = createOrthogonalPath(from, to);
	const points = parsePathPoints(pathStr);

	if (points.length < 2) {
		return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
	}

	// Calculate total path length
	let totalLen = 0;
	const segLengths: number[] = [];
	for (let i = 1; i < points.length; i++) {
		const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
		segLengths.push(len);
		totalLen += len;
	}

	// Find the point at half the total length
	const halfLen = totalLen / 2;
	let walked = 0;
	for (let i = 0; i < segLengths.length; i++) {
		if (walked + segLengths[i] >= halfLen) {
			const remaining = halfLen - walked;
			const t = segLengths[i] > 0 ? remaining / segLengths[i] : 0;
			return {
				x: points[i].x + (points[i + 1].x - points[i].x) * t,
				y: points[i].y + (points[i + 1].y - points[i].y) * t
			};
		}
		walked += segLengths[i];
	}

	// Fallback
	return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

/** Parse "M x y L x y L x y ..." into point array */
function parsePathPoints(d: string): { x: number; y: number }[] {
	const points: { x: number; y: number }[] = [];
	const parts = d.split(/[ML]\s*/).filter(Boolean);
	for (const part of parts) {
		const nums = part.trim().split(/\s+/).map(Number);
		if (nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
			points.push({ x: nums[0], y: nums[1] });
		}
	}
	return points;
}
