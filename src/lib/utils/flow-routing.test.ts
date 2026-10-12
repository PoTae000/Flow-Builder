import { describe, it, expect } from 'vitest';
import { computeFlowPorts, getFlowEdgeRoute } from './flow-routing';
import type { FlowNode } from '../types/flowchart';

const a: FlowNode = { id: 'a', name: 'A', type: 'process', position: { x: 100, y: 100 } };
const b: FlowNode = { id: 'b', name: 'B', type: 'process', position: { x: 100, y: 300 } };
describe('shared flowchart ports and loops', () => {
 it('routes a backward link around both endpoint boxes', () => {
  const route = getFlowEdgeRoute({ fromSide: 'bottom', toSide: 'top' }, b, a);
  expect(route.some(p => Math.abs(p.x - 100) >= 70)).toBe(true);
  for (let i = 1; i < route.length; i++) {
   const p = route[i - 1], q = route[i];
   for (const node of [a, b]) {
    const cx = node.position.x, cy = node.position.y;
    if (p.x === q.x && p.x > cx - 70 && p.x < cx + 70) {
     expect(Math.max(p.y, q.y) <= cy - 30 || Math.min(p.y, q.y) >= cy + 30).toBe(true);
    }
   }
  }
 });
 it('keeps explicitly selected incoming and outgoing ports at the same point', () => {
  const ports = computeFlowPorts([
   { id: 'forward', fromNodeId: 'a', toNodeId: 'b', fromSide: 'bottom', toSide: 'top' },
   { id: 'return', fromNodeId: 'b', toNodeId: 'a', fromSide: 'right', toSide: 'bottom' }
  ], [a, b]);
  expect(ports.get('forward')!.fp).toEqual(ports.get('return')!.tp);
 });
 it('routes a self loop outside the node with orthogonal segments', () => {
  for (const fromSide of ['top', 'right', 'bottom', 'left'] as const) {
   for (const toSide of ['top', 'right', 'bottom', 'left'] as const) {
    const route = getFlowEdgeRoute({ fromSide, toSide }, a, a);
    expect(route.length).toBeGreaterThan(3);
    for (let i = 1; i < route.length; i++) {
     expect(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y).toBe(true);
    }
   }
  }
 });
});
