import type { ConnectionPoint, Position, Rect } from '$lib/types/geometry';
export interface ERAnchor { side: ConnectionPoint['side']; ratio: number }
export function anchorPoint(rect: Rect, anchor: ERAnchor): ConnectionPoint {
 const t = Math.max(0, Math.min(1, anchor.ratio));
 const side = anchor.side;
 return side === 'left' || side === 'right'
 ? { side, x: rect.x + (side === 'right' ? rect.width : 0), y: rect.y + t * rect.height }
 : { side, x: rect.x + t * rect.width, y: rect.y + (side === 'bottom' ? rect.height : 0) };
}
export function nearestAnchor(rect: Rect, point: Position): ERAnchor {
 const candidates = (['top', 'right', 'bottom', 'left'] as const).map(side => {
 const horizontal = side === 'top' || side === 'bottom';
 const ratio = Math.max(.05,Math.min(.95, horizontal ? (point.x-rect.x)/rect.width : (point.y-rect.y)/rect.height));
 const anchor = { side, ratio }; const p = anchorPoint(rect,anchor);
 return { anchor, distance: Math.hypot(p.x-point.x,p.y-point.y) };
 });
 return candidates.sort((a,b)=>a.distance-b.distance)[0].anchor;
}
