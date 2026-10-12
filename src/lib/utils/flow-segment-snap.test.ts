import { expect, it } from 'vitest';
import { snapFlowSegment } from './flow-segment-snap';
const routes = [[{ x: 100, y: 0 }, { x: 100, y: 200 }]];
it('snaps an overlapping vertical segment to the closest line', () => {
	expect(snapFlowSegment(107, 'x', [50, 150], routes, 10)).toBe(100);
});
it('does not snap distant lines or segments with no overlap', () => {
	expect(snapFlowSegment(115, 'x', [50, 150], routes, 10)).toBeNull();
	expect(snapFlowSegment(107, 'x', [250, 300], routes, 10)).toBeNull();
});
it('supports horizontal segments and chooses the nearest candidate', () => {
	expect(snapFlowSegment(204, 'y', [0, 100], [[{ x: 0, y: 200 }, { x: 120, y: 200 }], [{ x: 0, y: 210 }, { x: 120, y: 210 }]], 10)).toBe(200);
});
