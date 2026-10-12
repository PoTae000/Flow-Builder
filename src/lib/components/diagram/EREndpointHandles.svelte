<script lang="ts">
 import type { Relationship } from '$lib/types/er';
 import type { ConnectionPoint, Rect } from '$lib/types/geometry';
 import { nearestAnchor, anchorPoint, type ERAnchor } from '$lib/utils/er-ports';
 import { diagram } from '$lib/stores/diagram.svelte';
 import { collab } from '$lib/stores/collab.svelte';
 let { relationship, fromPoint, toPoint, fromRect, toRect }: { relationship: Relationship; fromPoint: ConnectionPoint; toPoint: ConnectionPoint; fromRect: Rect; toRect: Rect } = $props();
 let dragging = $state<'fromAnchor' | 'toAnchor' | null>(null);
 let anchor = $state<ERAnchor | null>(null);
 function move(e: PointerEvent) {
  if (!dragging) return;
  const svg = (e.currentTarget as SVGElement).ownerSVGElement;
  if (!svg) return;
  const matrix = svg.getScreenCTM();
  if (!matrix) return;
  const p = new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
  const point = { x: (p.x-diagram.panX)/diagram.zoom, y: (p.y-diagram.panY)/diagram.zoom };
  anchor = nearestAnchor(dragging === 'fromAnchor' ? fromRect : toRect,point);
 }
 function end(e: PointerEvent) {
  e.stopPropagation();
  if (dragging && anchor) diagram.updateRelationship(relationship.id, { [dragging]: anchor, waypoints: [], fromWaypoints: [], toWaypoints: [] });
  dragging=null; anchor=null;
 }
</script>
{#if !diagram.viewOnly && !collab.isViewer}
 {#each ['fromAnchor', 'toAnchor'] as endName}
  {@const rect = endName === 'fromAnchor' ? fromRect : toRect}
  {@const point = dragging === endName && anchor ? anchorPoint(rect,anchor) : endName === 'fromAnchor' ? fromPoint : toPoint}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <g style="cursor:grab;touch-action:none" onpointerdown={(e)=>{ if (e.button!==0 || collab.lockLabel(relationship.id)) return; e.preventDefault();e.stopPropagation(); dragging=endName as typeof dragging; anchor=null; (e.currentTarget as Element).setPointerCapture(e.pointerId); }} onpointermove={move} onpointerup={end} onpointercancel={()=>{dragging=null;anchor=null;}} onmousedown={(e)=>e.stopPropagation()} ontouchstart={(e)=>e.stopPropagation()}>
   <circle cx={point.x} cy={point.y} r={10/diagram.zoom} fill="transparent" />
   <circle cx={point.x} cy={point.y} r={4/diagram.zoom} fill="var(--ui-bg)" stroke="#60a5fa" stroke-width={1.5/diagram.zoom} />
  </g>
 {/each}
{/if}
