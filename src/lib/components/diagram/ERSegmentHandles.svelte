<script lang="ts">
 import type { Relationship } from '$lib/types/er';
 import type { Position, Rect } from '$lib/types/geometry';
 import { diagram } from '$lib/stores/diagram.svelte';
 import { collab } from '$lib/stores/collab.svelte';
 let { relationship, route, rects, field = 'waypoints' }: { relationship: Relationship; route: Position[]; rects: Rect[]; field?: 'waypoints' | 'fromWaypoints' | 'toWaypoints' } = $props();
 let drag: { pointer: number; index: number; x: number; y: number; base: Position[] } | null = null;
 let preview = $state<Position[] | null>(null);
 function start(e: PointerEvent, index: number) {
  if (e.button !== 0 || diagram.viewOnly || collab.isViewer) return;
  e.stopPropagation(); e.preventDefault();
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
  drag = { pointer: e.pointerId, index, x: e.clientX, y: e.clientY, base: route.map(p => ({ ...p })) };
 }
 function move(e: PointerEvent) {
  if (!drag || drag.pointer !== e.pointerId) return;
  e.stopPropagation();
  const { base, index } = drag;
  const axis = Math.abs(base[index].x - base[index + 1].x) < .01 ? 'x' : 'y';
  const delta = (axis === 'x' ? e.clientX - drag.x : e.clientY - drag.y) / diagram.zoom;
  let value = base[index][axis] + delta;
  if (e.shiftKey) value = Math.round(value / 10) * 10;
  const moved = base.map(p => ({ ...p }));
  moved[index][axis] = value; moved[index + 1][axis] = value;
  if (index === 0) {
   const a = base[0], b = base[1], length = Math.min(20, Math.hypot(b.x-a.x,b.y-a.y)/2);
   const stub = { x: a.x + Math.sign(b.x-a.x)*length, y: a.y + Math.sign(b.y-a.y)*length };
   moved.splice(0, 1, { ...a }, stub, { ...stub, [axis]: value });
  }
  if (index === base.length - 2) {
   const a = base[base.length-1], b = base[base.length-2], length = Math.min(20,Math.hypot(b.x-a.x,b.y-a.y)/2);
   const stub = { x: a.x+Math.sign(b.x-a.x)*length, y: a.y+Math.sign(b.y-a.y)*length };
   moved.splice(moved.length-1,1,{ ...stub, [axis]: value },stub,{ ...a });
  }
  const crosses = rects.some(r => moved.slice(1).some((b,i) => {
   const a = moved[i], left=r.x+.5, right=r.x+r.width-.5, top=r.y+.5, bottom=r.y+r.height-.5;
   if (Math.abs(a.x-b.x)<.01) return a.x>left && a.x<right && Math.max(a.y,b.y)>top && Math.min(a.y,b.y)<bottom;
   if (Math.abs(a.y-b.y)<.01) return a.y>top && a.y<bottom && Math.max(a.x,b.x)>left && Math.min(a.x,b.x)<right;
   return true;
  }));
  if (!crosses) preview = moved;
 }
 function end(e: PointerEvent) {
  if (!drag || drag.pointer !== e.pointerId) return;
  e.stopPropagation();
  if (preview) diagram.updateRelationship(relationship.id, { [field]: preview.slice(1,-1) });
  drag=null; preview=null;
 }
</script>
{#if !diagram.viewOnly && !collab.isViewer}
 {#if preview}<path d={preview.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke="#60a5fa" stroke-width="2" pointer-events="none" />{/if}
 {#each route.slice(1) as b, index}
  {@const a=route[index]}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <g style="cursor:move;touch-action:none" onpointerdown={(e)=>start(e,index)} onpointermove={move} onpointerup={end} onpointercancel={()=>{drag=null;preview=null;}} onmousedown={(e)=>e.stopPropagation()}>
   <path d={`M${a.x},${a.y} L${b.x},${b.y}`} stroke="transparent" stroke-width={12/diagram.zoom} fill="none" />
   <circle cx={(a.x+b.x)/2} cy={(a.y+b.y)/2} r={3.5/diagram.zoom} fill="#60a5fa" stroke="white" stroke-width={1/diagram.zoom} />
  </g>
 {/each}
{/if}
