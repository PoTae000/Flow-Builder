






import type { FlowNode } from '$lib/types/flowchart';

export type Side = 'top' | 'right' | 'bottom' | 'left';
export interface Pt {
	x: number;
	y: number;
}


export const STUB = 20;


export function getFlowPort(
	node: { position: { x: number; y: number }; type: string; width?: number; height?: number },
	side: Side
): Pt {
	const { x: cx, y: cy } = node.position;
	const W = node.width || (node.type === 'connector' ? 28 : 140);
	const H = node.height || (node.type === 'connector' ? 28 : 60);

	if (node.type === 'decision') {

		const hw = W / 2 + 10,
			hh = H / 2 + 5;
		if (side === 'top') return { x: cx, y: cy - hh };
		if (side === 'bottom') return { x: cx, y: cy + hh };
		if (side === 'left') return { x: cx - hw, y: cy };
		return { x: cx + hw, y: cy };
	}
	if (node.type === 'connector' || node.type === 'circle' || node.type === 'square') {


		const r = Math.min(W, H) / 2;
		if (side === 'top') return { x: cx, y: cy - r };
		if (side === 'bottom') return { x: cx, y: cy + r };
		if (side === 'left') return { x: cx - r, y: cy };
		return { x: cx + r, y: cy };
	}
	const hw = W / 2,
		hh = H / 2;
	if (side === 'top') return { x: cx, y: cy - hh };
	if (side === 'bottom') return { x: cx, y: cy + hh };



	if (node.type === 'input-output') {

		if (side === 'left') return { x: cx - hw + 7.5, y: cy };
		if (side === 'right') return { x: cx + hw - 7.5, y: cy };
	} else if (node.type === 'trapezoid') {

		if (side === 'left') return { x: cx - hw + 10, y: cy };
		if (side === 'right') return { x: cx + hw - 10, y: cy };
	} else if (node.type === 'manual-operation') {
		if (side === 'left') return { x: cx - hw + 7.5, y: cy };
		if (side === 'right') return { x: cx + hw - 7.5, y: cy };
	}


	if (side === 'left') return { x: cx - hw, y: cy };
	return { x: cx + hw, y: cy };
}


function dir(side: Side): Pt {
	if (side === 'top') return { x: 0, y: -1 };
	if (side === 'bottom') return { x: 0, y: 1 };
	if (side === 'left') return { x: -1, y: 0 };
	return { x: 1, y: 0 };
}

const isH = (s: Side) => s === 'left' || s === 'right';


function clean(pts: Pt[]): Pt[] {
	const out: Pt[] = [];
	for (const p of pts) {
		const last = out[out.length - 1];
		if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
		out.push({ x: p.x, y: p.y });
	}

	const res: Pt[] = [];
	for (let i = 0; i < out.length; i++) {
		if (i > 0 && i < out.length - 1) {
			const a = out[i - 1],
				b = out[i],
				c = out[i + 1];
			const collinearX = Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01;
			const collinearY = Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01;
			if (collinearX || collinearY) continue;
		}
		res.push(out[i]);
	}
	return res;
}


export function routeFromPortToPoint(start: Pt, fromSide: Side, end: Pt): Pt[] {
	const d = dir(fromSide);
	const ep = { x: start.x + d.x * STUB, y: start.y + d.y * STUB };
	if (isH(fromSide)) {

		const midX = (ep.x + end.x) / 2;
		return clean([start, ep, { x: midX, y: ep.y }, { x: midX, y: end.y }, end]);
	}
	const midY = (ep.y + end.y) / 2;
	return clean([start, ep, { x: ep.x, y: midY }, { x: end.x, y: midY }, end]);
}


export function routePorts(
	fp: Pt,
	fromSide: Side,
	tp: Pt,
	toSide: Side,
	offset = 0
): Pt[] {
	const fd = dir(fromSide);
	const td = dir(toSide);

	const ep = { x: fp.x + fd.x * STUB, y: fp.y + fd.y * STUB };
	const xp = { x: tp.x + td.x * STUB, y: tp.y + td.y * STUB };

	const fromH = isH(fromSide);
	const toH = isH(toSide);

	let mids: Pt[];
	if (!fromH && !toH) {

		const midY = (ep.y + xp.y) / 2 + offset;
		mids = [
			{ x: ep.x, y: midY },
			{ x: xp.x, y: midY }
		];
	} else if (fromH && toH) {

		const midX = (ep.x + xp.x) / 2 + offset;
		mids = [
			{ x: midX, y: ep.y },
			{ x: midX, y: xp.y }
		];
	} else if (!fromH && toH) {

		mids = [{ x: ep.x, y: xp.y }];
	} else {

		mids = [{ x: xp.x, y: ep.y }];
	}

	return clean([fp, ep, ...mids, xp, tp]);
}


export function chooseFlowSides(
	fromNode: FlowNode,
	toNode: FlowNode
): { fromSide: Side; toSide: Side } {
	const dx = toNode.position.x - fromNode.position.x;
	const dy = toNode.position.y - fromNode.position.y;
	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0
			? { fromSide: 'right', toSide: 'left' }
			: { fromSide: 'left', toSide: 'right' };
	}
	return dy >= 0
		? { fromSide: 'bottom', toSide: 'top' }
		: { fromSide: 'top', toSide: 'bottom' };
}


export function resolveFlowSides(
	edge: { fromSide?: Side; toSide?: Side },
	fromNode: FlowNode,
	toNode: FlowNode
): { fromSide: Side; toSide: Side } {
	const auto = chooseFlowSides(fromNode, toNode);
	return {
		fromSide: edge.fromSide ?? auto.fromSide,
		toSide: edge.toSide ?? auto.toSide
	};
}








const SLOT_SPACING = 22;


function slotOffsets(count: number, span: number): number[] {
	if (count <= 1) return [0];

	const usable = Math.min(span - 12, SLOT_SPACING * (count - 1));
	const step = usable / (count - 1);
	const start = -usable / 2;
	return Array.from({ length: count }, (_, i) => start + i * step);
}


export function getFlowPortSlot(
	node: { position: { x: number; y: number }; type: string; width?: number; height?: number },
	side: Side,
	index: number,
	count: number
): Pt {
	const base = getFlowPort(node, side);
	if (count <= 1) return base;


	if (node.type === 'decision') {
		return base;
	}
	const W = node.width || (node.type === 'connector' ? 28 : 140);
	const H = node.height || (node.type === 'connector' ? 28 : 60);




	const isRound = node.type === 'connector' || node.type === 'circle' || node.type === 'square';
	const span = isRound
		? Math.min(W, H) * 0.9
		: isH(side)
			? H
			: W;
	const off = slotOffsets(count, span)[index] ?? 0;
	if (isH(side)) {



		const y = base.y + off;
		return { x: slantedEdgeX(node, side, y), y };
	}
	return { x: base.x + off, y: base.y };
}


function slantedEdgeX(
	node: { position: { x: number; y: number }; type: string; width?: number; height?: number },
	side: Side,
	y: number
): Pt['x'] {
	const { x: cx, y: cy } = node.position;
	const W = node.width || (node.type === 'connector' ? 28 : 140);
	const H = node.height || (node.type === 'connector' ? 28 : 60);
	const base = getFlowPort(node, side).x;

	const dy = Math.max(-H / 2, Math.min(H / 2, y - cy));
	const t = H > 0 ? (dy + H / 2) / H : 0.5;

	if (node.type === 'input-output') {



		const inset = 15 * (side === 'left' ? 1 - t : t);
		return side === 'left' ? cx - W / 2 + inset : cx + W / 2 - inset;
	}
	if (node.type === 'trapezoid') {


		const inset = 20 * (1 - t);
		return side === 'left' ? cx - W / 2 + inset : cx + W / 2 - inset;
	}
	if (node.type === 'manual-operation') {

		const inset = 15 * t;
		return side === 'left' ? cx - W / 2 + inset : cx + W / 2 - inset;
	}
	if (node.type === 'preparation') {

		const inset = 20 * (1 - Math.abs(dy) / (H / 2));
		return side === 'left' ? cx - W / 2 + inset : cx + W / 2 - inset;
	}
	return base;
}

export interface FlowPortInfo {
	fromSide: Side;
	toSide: Side;
	fp: Pt;
	tp: Pt;
}


function sideFit(side: Side, node: { position: Pt }, other: Pt): number {
	const d = dir(side);
	const vx = other.x - node.position.x;
	const vy = other.y - node.position.y;
	const len = Math.hypot(vx, vy) || 1;
	return (d.x * vx + d.y * vy) / len;
}

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

interface Endpoint {
	edgeId: string;
	end: 'from' | 'to';
	node: FlowNode;
	other: Pt;
	manual: boolean;
	side: Side;
}


function balanceNodeSides(eps: Endpoint[]): void {
	const auto = eps.filter((ep) => !ep.manual);
	if (auto.length === 0) return;

	for (let iter = 0; iter < 8; iter++) {
		const count: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 };
		for (const ep of eps) count[ep.side]++;

		const free = SIDES.filter((s) => count[s] === 0);
		if (free.length === 0) break;
		const crowdedExists = SIDES.some((s) => count[s] > 1);
		if (!crowdedExists) break;



		let best: { ep: Endpoint; side: Side; fit: number } | null = null;
		for (const ep of auto) {
			if (count[ep.side] <= 1) continue;
			for (const s of free) {
				const fit = sideFit(s, ep.node, ep.other);
				if (!best || fit > best.fit) best = { ep, side: s, fit };
			}
		}
		if (!best) break;
		best.ep.side = best.side;
	}
}


export function computeFlowPorts(
	edges: { id: string; fromNodeId: string; toNodeId: string; fromSide?: Side; toSide?: Side }[],
	nodes: FlowNode[]
): Map<string, FlowPortInfo> {
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));



	const endpointsByNode = new Map<string, Endpoint[]>();
	const epFrom = new Map<string, Endpoint>();
	const epTo = new Map<string, Endpoint>();

	for (const e of edges) {
		const fromNode = nodeMap.get(e.fromNodeId);
		const toNode = nodeMap.get(e.toNodeId);
		if (!fromNode || !toNode) continue;
		const rs = resolveFlowSides(e, fromNode, toNode);

		const fEp: Endpoint = {
			edgeId: e.id,
			end: 'from',
			node: fromNode,
			other: toNode.position,
			manual: e.fromSide !== undefined,
			side: rs.fromSide
		};
		const tEp: Endpoint = {
			edgeId: e.id,
			end: 'to',
			node: toNode,
			other: fromNode.position,
			manual: e.toSide !== undefined,
			side: rs.toSide
		};
		epFrom.set(e.id, fEp);
		epTo.set(e.id, tEp);
		(endpointsByNode.get(e.fromNodeId) ?? endpointsByNode.set(e.fromNodeId, []).get(e.fromNodeId)!).push(fEp);
		(endpointsByNode.get(e.toNodeId) ?? endpointsByNode.set(e.toNodeId, []).get(e.toNodeId)!).push(tEp);
	}



	for (const eps of endpointsByNode.values()) balanceNodeSides(eps);



	const sidesById = new Map<string, { fromSide: Side; toSide: Side }>();
	interface Slot {
		node: FlowNode;
		side: Side;
		items: { edgeId: string; end: 'from' | 'to'; other: { x: number; y: number } }[];
	}
	const groups = new Map<string, Slot>();

	for (const e of edges) {
		const fEp = epFrom.get(e.id);
		const tEp = epTo.get(e.id);
		if (!fEp || !tEp) continue;
		sidesById.set(e.id, { fromSide: fEp.side, toSide: tEp.side });

		const fk = `${e.fromNodeId}:${fEp.side}`;
		const tk = `${e.toNodeId}:${tEp.side}`;
		if (!groups.has(fk)) groups.set(fk, { node: fEp.node, side: fEp.side, items: [] });
		if (!groups.has(tk)) groups.set(tk, { node: tEp.node, side: tEp.side, items: [] });
		groups.get(fk)!.items.push({ edgeId: e.id, end: 'from', other: fEp.other });
		groups.get(tk)!.items.push({ edgeId: e.id, end: 'to', other: tEp.other });
	}



	const slotById = new Map<string, { slot: number; count: number }>();
	for (const g of groups.values()) {
		const horizontal = g.side === 'top' || g.side === 'bottom';
		g.items.sort((a, b) => (horizontal ? a.other.x - b.other.x : a.other.y - b.other.y));
		g.items.forEach((it, i) => slotById.set(`${it.edgeId}:${it.end}`, { slot: i, count: g.items.length }));
	}

	const result = new Map<string, FlowPortInfo>();
	for (const e of edges) {
		const rs = sidesById.get(e.id);
		const fromNode = nodeMap.get(e.fromNodeId);
		const toNode = nodeMap.get(e.toNodeId);
		if (!rs || !fromNode || !toNode) continue;
		const fs = slotById.get(`${e.id}:from`);
		const ts = slotById.get(`${e.id}:to`);
		const fp = e.fromSide ? getFlowPort(fromNode, rs.fromSide) : getFlowPortSlot(fromNode, rs.fromSide, fs?.slot ?? 0, fs?.count ?? 1);
		const tp = e.toSide ? getFlowPort(toNode, rs.toSide) : getFlowPortSlot(toNode, rs.toSide, ts?.slot ?? 0, ts?.count ?? 1);
		result.set(e.id, { fromSide: rs.fromSide, toSide: rs.toSide, fp, tp });
	}
	return result;
}


interface Rect {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}
function nodeRect(n: FlowNode, margin: number): Rect {
	const W = n.width || (n.type === 'connector' ? 28 : 140);
	const H = n.height || (n.type === 'connector' ? 28 : 60);
	return {
		x1: n.position.x - W / 2 - margin,
		y1: n.position.y - H / 2 - margin,
		x2: n.position.x + W / 2 + margin,
		y2: n.position.y + H / 2 + margin
	};
}

const EPS = 0.5;


function segHitsRect(a: Pt, b: Pt, r: Rect): boolean {
	if (Math.abs(a.y - b.y) < EPS) {

		if (a.y <= r.y1 + EPS || a.y >= r.y2 - EPS) return false;
		const lo = Math.min(a.x, b.x);
		const hi = Math.max(a.x, b.x);
		return hi > r.x1 + EPS && lo < r.x2 - EPS;
	}

	if (a.x <= r.x1 + EPS || a.x >= r.x2 - EPS) return false;
	const lo = Math.min(a.y, b.y);
	const hi = Math.max(a.y, b.y);
	return hi > r.y1 + EPS && lo < r.y2 - EPS;
}

function segHitsAny(a: Pt, b: Pt, rects: Rect[]): boolean {
	for (const r of rects) if (segHitsRect(a, b, r)) return true;
	return false;
}

function pointInRect(p: Pt, r: Rect): boolean {
	return p.x > r.x1 + EPS && p.x < r.x2 - EPS && p.y > r.y1 + EPS && p.y < r.y2 - EPS;
}


function routeAvoidingGrid(ep: Pt, xp: Pt, rects: Rect[]): Pt[] | null {

	const xsSet = new Set<number>([ep.x, xp.x]);
	const ysSet = new Set<number>([ep.y, xp.y]);
	for (const r of rects) {
		xsSet.add(r.x1);
		xsSet.add(r.x2);
		ysSet.add(r.y1);
		ysSet.add(r.y2);
	}
	const xs = [...xsSet].sort((a, b) => a - b);
	const ys = [...ysSet].sort((a, b) => a - b);
	if (xs.length * ys.length > 2500) return null;

	const xi = (x: number) => xs.indexOf(x);
	const yi = (y: number) => ys.indexOf(y);
	const startX = xi(ep.x);
	const startY = yi(ep.y);
	const goalX = xi(xp.x);
	const goalY = yi(xp.y);
	if (startX < 0 || startY < 0 || goalX < 0 || goalY < 0) return null;

	const key = (gx: number, gy: number, dir: number) => gx * 10000 + gy * 10 + dir;

	const gScore = new Map<number, number>();
	const cameFrom = new Map<number, number>();
	const startKey = key(startX, startY, 0);
	gScore.set(startKey, 0);


	const open: { k: number; gx: number; gy: number; dir: number; f: number }[] = [
		{ k: startKey, gx: startX, gy: startY, dir: 0, f: 0 }
	];
	const TURN = 40;

	const heur = (gx: number, gy: number) => Math.abs(xs[gx] - xp.x) + Math.abs(ys[gy] - xp.y);

	let goalKey = -1;
	while (open.length) {

		let bi = 0;
		for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
		const cur = open.splice(bi, 1)[0];
		if (cur.gx === goalX && cur.gy === goalY) {
			goalKey = cur.k;
			break;
		}
		const curG = gScore.get(cur.k) ?? Infinity;

		const steps = [
			{ dx: 1, dy: 0, d: 1 },
			{ dx: -1, dy: 0, d: 1 },
			{ dx: 0, dy: 1, d: 2 },
			{ dx: 0, dy: -1, d: 2 }
		];
		for (const s of steps) {
			const ngx = cur.gx + s.dx;
			const ngy = cur.gy + s.dy;
			if (ngx < 0 || ngx >= xs.length || ngy < 0 || ngy >= ys.length) continue;
			const a = { x: xs[cur.gx], y: ys[cur.gy] };
			const b = { x: xs[ngx], y: ys[ngy] };
			if (segHitsAny(a, b, rects)) continue;
			const dist = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
			const turn = cur.dir !== 0 && cur.dir !== s.d ? TURN : 0;
			const ng = curG + dist + turn;
			const nk = key(ngx, ngy, s.d);
			if (ng < (gScore.get(nk) ?? Infinity)) {
				gScore.set(nk, ng);
				cameFrom.set(nk, cur.k);
				open.push({ k: nk, gx: ngx, gy: ngy, dir: s.d, f: ng + heur(ngx, ngy) });
			}
		}
	}
	if (goalKey < 0) return null;


	const pts: Pt[] = [];
	let k = goalKey;
	while (k !== undefined) {
		const gx = Math.floor(k / 10000);
		const gy = Math.floor((k % 10000) / 10);
		pts.push({ x: xs[gx], y: ys[gy] });
		const prev = cameFrom.get(k);
		if (prev === undefined) break;
		k = prev;
	}
	pts.reverse();

	return pts.slice(1, -1);
}


function routeAvoiding(
	fp: Pt,
	fromSide: Side,
	tp: Pt,
	toSide: Side,
	obstacles: FlowNode[]
): Pt[] | null {
	const margin = 16;
	const rects = obstacles.map((n) => nodeRect(n, margin));
	const fd = dir(fromSide);
	const td = dir(toSide);
	const ep = { x: fp.x + fd.x * STUB, y: fp.y + fd.y * STUB };
	const xp = { x: tp.x + td.x * STUB, y: tp.y + td.y * STUB };

	for (const r of rects) if (pointInRect(ep, r) || pointInRect(xp, r)) return null;

	const mids = routeAvoidingGrid(ep, xp, rects);
	if (mids === null) return null;
	return clean([fp, ep, ...mids, xp, tp]);
}


export function getFlowEdgeRoute(
	edge: { fromSide?: Side; toSide?: Side; waypoints?: Pt[]; routingMode?: 'auto' | 'horizontal' | 'vertical' | 'elbow' | 'step' },
	fromNode: FlowNode,
	toNode: FlowNode,
	offset = 0,
	obstacles?: FlowNode[],
	ports?: FlowPortInfo
): Pt[] {
	const fromSide = ports?.fromSide ?? resolveFlowSides(edge, fromNode, toNode).fromSide;
	const toSide = ports?.toSide ?? resolveFlowSides(edge, fromNode, toNode).toSide;
	const fp = ports?.fp ?? getFlowPort(fromNode, fromSide);
	const tp = ports?.tp ?? getFlowPort(toNode, toSide);
	if (fromNode.id === toNode.id && !edge.waypoints?.length) {
		const margin = 40 + Math.abs(offset);
		const right = fromNode.position.x + (fromNode.width || 140) / 2 + margin;
		const top = fromNode.position.y - (fromNode.height || 60) / 2 - margin;
		const left = fromNode.position.x - (fromNode.width || 140) / 2 - margin;
		const bottom = fromNode.position.y + (fromNode.height || 60) / 2 + margin;
		const corners: Record<Side, Pt> = { top: { x: left, y: top }, right: { x: right, y: top }, bottom: { x: right, y: bottom }, left: { x: left, y: bottom } };
		const order: Side[] = ['top', 'right', 'bottom', 'left'];
		const start = { x: fp.x + dir(fromSide).x * margin, y: fp.y + dir(fromSide).y * margin };
		const end = { x: tp.x + dir(toSide).x * margin, y: tp.y + dir(toSide).y * margin };
		const points = [fp, start];
		let side = fromSide;
		do {
			side = order[(order.indexOf(side) + 1) % 4];
			points.push(corners[side]);
		} while (side !== toSide);
		return clean([...points, end, tp]);
	}

	if (!edge.waypoints?.length && edge.routingMode === 'step' && fromNode.id !== toNode.id) {
  const fd = dir(fromSide), td = dir(toSide);
  const start = { x: fp.x + fd.x * STUB, y: fp.y + fd.y * STUB };
  const end = { x: tp.x + td.x * STUB, y: tp.y + td.y * STUB };
  const x1 = start.x + (end.x - start.x) / 3, x2 = start.x + (end.x - start.x) * 2 / 3;
  const y = (start.y + end.y) / 2;
  return clean([fp, start, { x: x1, y: start.y }, { x: x1, y }, { x: x2, y }, { x: x2, y: end.y }, end, tp]);
 }

	if (edge.waypoints && edge.waypoints.length === 1) {
		const wp = edge.waypoints[0];
		if (fromSide === 'top' || fromSide === 'bottom') {
			return clean([fp, { x: fp.x, y: wp.y }, { x: tp.x, y: wp.y }, tp]);
		}
		return clean([fp, { x: wp.x, y: fp.y }, { x: wp.x, y: tp.y }, tp]);
	}
	if (edge.waypoints && edge.waypoints.length > 1) {
		const points = edge.waypoints.map(p => ({ ...p }));
  if (isH(fromSide)) points[0].y = fp.y; else points[0].x = fp.x;
  if (isH(toSide)) points[points.length - 1].y = tp.y; else points[points.length - 1].x = tp.x;
  return clean([fp, ...points, tp]);
	}

	const simple = routePorts(fp, fromSide, tp, toSide, offset);




	{
		const others = [fromNode, toNode, ...(obstacles ?? []).filter((n) => n.id !== fromNode.id && n.id !== toNode.id)];
		const rects = others.map((n) => nodeRect(n, 0));
		let collides = false;
		for (let i = 0; i < simple.length - 1 && !collides; i++) {
			if (segHitsAny(simple[i], simple[i + 1], rects)) collides = true;
		}
		if (collides) {
			const avoided = routeAvoiding(fp, fromSide, tp, toSide, others);
			if (avoided) return avoided;
		}
	}

	return simple;
}


export function nearestSide(node: FlowNode, p: Pt): Side {



	const sides: Side[] = ['top', 'right', 'bottom', 'left'];
	let best: Side = 'top';
	let bestD = Infinity;
	for (const s of sides) {
		const port = getFlowPort(node as { position: { x: number; y: number }; type: string; width?: number; height?: number }, s);
		const d = (p.x - port.x) ** 2 + (p.y - port.y) ** 2;
		if (d < bestD) {
			bestD = d;
			best = s;
		}
	}
	return best;
}
