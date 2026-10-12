import { expect, it } from 'vitest';
import { anchorPoint, nearestAnchor } from './er-ports';

it('keeps dragged endpoints on the perimeter and follows entity resize/move', () => {
 const rect = { x: 100, y: 200, width: 200, height: 100 };
 const anchor = nearestAnchor(rect, { x: 250, y: 195 });
 expect(anchor).toEqual({ side: 'top', ratio: .75 });
 expect(anchorPoint(rect,anchor)).toEqual({ x: 250, y: 200, side: 'top' });
 expect(anchorPoint({ x: 0, y: 0, width: 400, height: 200 },anchor)).toEqual({ x: 300, y: 0, side: 'top' });
});

it('clamps endpoints dragged outside an entity instead of leaving them floating', () => {
 const rect = { x: 0, y: 0, width: 100, height: 100 };
 const anchor = nearestAnchor(rect,{ x: 500, y: 50 });
 expect(anchorPoint(rect,anchor)).toEqual({ x: 100, y: 50, side: 'right' });
});
