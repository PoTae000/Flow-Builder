<script lang="ts">
 import { diagram } from '$lib/stores/diagram.svelte';
 import { collab } from '$lib/stores/collab.svelte';
 import DraggableLabel from './DraggableLabel.svelte';
 import EREndpointHandles from './EREndpointHandles.svelte';
 import ERSegmentHandles from './ERSegmentHandles.svelte';
 import EditableRelationshipText from './EditableRelationshipText.svelte';
	import type { Relationship } from '$lib/types/er';
	import { getFlowEdgeRoute } from '$lib/utils/flow-routing';
 import type { FlowNode } from '$lib/types/flowchart';
 import type { ConnectionPoint, Rect, Position } from '$lib/types/geometry';
	import type { NotationRenderer } from '$lib/renderers/types';
	import { theme } from '$lib/stores/theme.svelte';
	import { createDiamond } from '$lib/renderers/shared/svg-utils';

	let {
		relationship,
		fromRect,
		toRect,
		fromPoint,
		toPoint,
		renderer,
		selected = false,
		highlighted = false,
		animateIn = false,
		dying = false,
		onclick,
		ontouchstart
	}: {
		relationship: Relationship;
		fromRect: Rect;
		toRect: Rect;
		fromPoint: ConnectionPoint;
		toPoint: ConnectionPoint;
		renderer: NotationRenderer;
		selected?: boolean;
		highlighted?: boolean;
		animateIn?: boolean;
		dying?: boolean;
		onclick?: (e: MouseEvent) => void;
		ontouchstart?: (e: TouchEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);
	let previewPosition = $state<Position | null>(null);
 let drag: { pointer: number; x: number; y: number; original: Position } | null = null;
 const midX = $derived(previewPosition?.x ?? relationship.diamondPosition?.x ?? (fromPoint.x + toPoint.x) / 2);
	const midY = $derived(previewPosition?.y ?? relationship.diamondPosition?.y ?? (fromPoint.y + toPoint.y) / 2);
	const diamondW = 90;
	const diamondH = 44;

	const diamondPath = $derived(createDiamond(midX, midY, diamondW, diamondH));

	const diamondVertices = $derived([
		{ x: midX, y: midY - diamondH / 2 },
		{ x: midX + diamondW / 2, y: midY },
		{ x: midX, y: midY + diamondH / 2 },
		{ x: midX - diamondW / 2, y: midY }
	]);

	function bestDiamondPoint(entityPt: ConnectionPoint): { x: number; y: number } {
		let best = diamondVertices[0];
		let bestDist = Infinity;
		for (const p of diamondVertices) {
			const d = Math.hypot(p.x - entityPt.x, p.y - entityPt.y);
			if (d < bestDist) { bestDist = d; best = p; }
		}
		return best;
	}

	const fromDiamondPt = $derived(bestDiamondPoint(fromPoint));
	const toDiamondPt = $derived(bestDiamondPoint(toPoint));


 function leg(point: ConnectionPoint, rect: Rect, end: { x: number; y: number }, waypoints?: Relationship['waypoints']) {
  if (!waypoints?.length) return [point, end];
  const node = (id: string, r: Rect): FlowNode => ({ id, name: '', type: 'process', position: { x: r.x+r.width/2, y: r.y+r.height/2 }, width: r.width, height: r.height });
  const side = end.x < midX ? 'left' : end.x > midX ? 'right' : end.y < midY ? 'top' : 'bottom';
  return getFlowEdgeRoute({ waypoints }, node('entity', rect), node('diamond', { x: midX-diamondW/2, y: midY-diamondH/2, width: diamondW, height: diamondH }), 0, [], { fp: point, tp: end, fromSide: point.side, toSide: side });
 }
 const fromRoute = $derived(leg(fromPoint, fromRect, fromDiamondPt, previewPosition ? undefined : relationship.fromWaypoints));
 const toRoute = $derived(leg(toPoint, toRect, toDiamondPt, previewPosition ? undefined : relationship.toWaypoints));
	const pathFrom = $derived(fromRoute.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '));
	const pathTo = $derived(toRoute.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '));


	const distFrom = $derived(Math.hypot(fromDiamondPt.x - fromPoint.x, fromDiamondPt.y - fromPoint.y));
	const distTo = $derived(Math.hypot(toPoint.x - toDiamondPt.x, toPoint.y - toDiamondPt.y));

	const DUR = 0.6;
	const DIAMOND_DUR = 0.3;




	let dyingStep = $state(0);
	let animInStep = $state(0);
	let raf1 = 0;
	let raf2 = 0;

	$effect(() => {
		if (dying) {
			if (dyingStep === 0) {
				dyingStep = 1;
				raf1 = requestAnimationFrame(() => {
					raf2 = requestAnimationFrame(() => { dyingStep = 2; });
				});
			}
		} else {
			if (raf1) { cancelAnimationFrame(raf1); raf1 = 0; }
			if (raf2) { cancelAnimationFrame(raf2); raf2 = 0; }
			dyingStep = 0;
		}
	});

	$effect(() => {
		if (animateIn) {
			if (animInStep === 0) {
				animInStep = 1;
				requestAnimationFrame(() => {
					requestAnimationFrame(() => { animInStep = 2; });
				});
			}
		} else {
			animInStep = 0;
		}
	});




	function lineStyle(dist: number): string {
		if (dying) {
			return `stroke-dasharray: ${dist}; stroke-dashoffset: ${dyingStep >= 2 ? dist : 0}; transition: stroke-dashoffset ${DUR}s ease-in;`;
		}
		if (animateIn) {
			return `stroke-dasharray: ${dist}; stroke-dashoffset: ${animInStep >= 2 ? 0 : dist}; transition: stroke-dashoffset ${DUR}s ease-out ${DIAMOND_DUR}s;`;
		}
		return '';
	}


	function sideLabel(ax: number, ay: number, bx: number, by: number, offset: number): { x: number; y: number } {
		const mx = (ax + bx) / 2;
		const my = (ay + by) / 2;
		const dx = bx - ax;
		const dy = by - ay;
		const len = Math.hypot(dx, dy) || 1;
		let px = -dy / len;
		let py = dx / len;
		if (py > 0) { px = -px; py = -py; }
		return { x: mx + px * offset, y: my + py * offset };
	}

	const fromLabelPos = $derived(sideLabel(fromPoint.x, fromPoint.y, fromDiamondPt.x, fromDiamondPt.y, 14));
	const toLabelPos = $derived(sideLabel(toPoint.x, toPoint.y, toDiamondPt.x, toDiamondPt.y, 14));

	const strokeColor = $derived(selected ? colors.selectedStroke : colors.chenDiamondStroke);
 function startDiamond(e: PointerEvent) {
  if (e.button !== 0 || diagram.viewOnly || collab.isViewer || collab.lockLabel(relationship.id) || (e.target as Element).closest('input')) return;
  e.stopPropagation();
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
  diagram.selectRelationship(relationship.id);
  drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, original: { x: midX, y: midY } };
 }
 function moveDiamond(e: PointerEvent) {
  if (!drag || drag.pointer !== e.pointerId) return;
  e.stopPropagation();
  if (!previewPosition && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<3) return;
  let x=drag.original.x+(e.clientX-drag.x)/diagram.zoom, y=drag.original.y+(e.clientY-drag.y)/diagram.zoom;
  if (e.shiftKey) { x=Math.round(x/10)*10; y=Math.round(y/10)*10; }
  previewPosition={x,y};
 }
 function endDiamond(e: PointerEvent) {
  if (!drag || drag.pointer !== e.pointerId) return;
  e.stopPropagation();
  if (previewPosition) diagram.updateRelationship(relationship.id, { diamondPosition: previewPosition, fromWaypoints: [], toWaypoints: [] });
  drag=null; previewPosition=null;
 }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
	class="chen-diamond"
	class:animate-in={animateIn}
	class:dying
	role="button"
	tabindex="0"
	onclick={onclick}
	ontouchstart={ontouchstart}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: pointer;"
>

	<path d={pathFrom} fill="none" stroke="transparent" stroke-width="10" />
	<path d={pathTo} fill="none" stroke="transparent" stroke-width="10" />


	<path d={pathFrom} fill="none" stroke={colors.relationshipStroke} stroke-width="1.2"
		style={lineStyle(distFrom)} />

	<path d={pathTo} fill="none" stroke={colors.relationshipStroke} stroke-width="1.2"
		style={lineStyle(distTo)} />

	{#if !dying}
		{#if selected}
			<path d={createDiamond(midX, midY, diamondW + 6, diamondH + 6)}
				fill="none" stroke={colors.selectedStroke} stroke-width="2.5" opacity="0.4" />
		{/if}
		{#if highlighted}
			<path d={createDiamond(midX, midY, diamondW + 10, diamondH + 10)}
				fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 3" opacity="0.7" />
		{/if}
		{#if relationship.isIdentifying}
			<path d={createDiamond(midX, midY, diamondW - 10, diamondH - 10)}
				fill="none" stroke={colors.chenDiamondStroke} stroke-width="1.2" />
		{/if}
	{/if}


 <!-- svelte-ignore a11y_no_static_element_interactions -->
 <g style="cursor:move;touch-action:none" onpointerdown={startDiamond} onpointermove={moveDiamond} onpointerup={endDiamond} onpointercancel={()=>{drag=null;previewPosition=null;}} onmousedown={(e)=>e.stopPropagation()} ontouchstart={(e)=>e.stopPropagation()}>

	<path
		class="diamond-shape"
		d={diamondPath}
		fill={colors.chenDiamondFill}
		stroke={strokeColor}
		stroke-width="1.2"
	/>


	<EditableRelationshipText {relationship} x={midX - 40} y={midY - 10} width={80} height={20} fontSize={11}><text
		class="diamond-label"
		display={relationship.name.trim() ? undefined : 'none'}
		x={midX}
		y={midY}
		text-anchor="middle"
		dominant-baseline="central"
		font-size="11"
		fill={colors.relationshipText}
		font-weight="600"
	>
		{relationship.name}
	</text></EditableRelationshipText>
 {#if selected}<EREndpointHandles {relationship} {fromPoint} {toPoint} {fromRect} {toRect} />{/if}
</g>


	<DraggableLabel offset={relationship.fromCardinalityOffset} onchange={(offset) => diagram.updateRelationship(relationship.id, { fromCardinalityOffset: offset })}>
<text
		x={fromLabelPos.x}
		y={fromLabelPos.y}
		text-anchor="middle"
		font-size="12"
		font-weight="700"
		fill={colors.cardinalityText}
	>
		{renderer.formatCardinality(relationship.cardinalities[0])}
	</text>
 </DraggableLabel>

	<DraggableLabel offset={relationship.toCardinalityOffset} onchange={(offset) => diagram.updateRelationship(relationship.id, { toCardinalityOffset: offset })}>
<text
		x={toLabelPos.x}
		y={toLabelPos.y}
		text-anchor="middle"
		font-size="12"
		font-weight="700"
		fill={colors.cardinalityText}
	>
		{renderer.formatCardinality(relationship.cardinalities[1])}
	</text>
 </DraggableLabel>
{#if selected && fromRoute.length > 2}
 <ERSegmentHandles {relationship} route={fromRoute} rects={[fromRect, toRect, { x: midX-diamondW/2, y: midY-diamondH/2, width: diamondW, height: diamondH }]} field="fromWaypoints" />
{/if}
{#if selected && toRoute.length > 2}
 <ERSegmentHandles {relationship} route={toRoute} rects={[fromRect, toRect, { x: midX-diamondW/2, y: midY-diamondH/2, width: diamondW, height: diamondH }]} field="toWaypoints" />
{/if}
</g>

<style>
	/* === Animate In: diamond appears first, then lines draw === */
	@keyframes diamondAppear {
		from { opacity: 0; transform: scale(0); }
		to { opacity: 1; transform: scale(1); }
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	/* Diamond appears immediately */
	.chen-diamond.animate-in :global(.diamond-shape) {
		animation: diamondAppear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		transform-origin: center;
		transform-box: fill-box;
		opacity: 0;
	}
	/* Diamond label appears with diamond */
	.chen-diamond.animate-in :global(.diamond-label) {
		animation: fadeIn 0.2s ease 0.15s forwards;
		opacity: 0;
	}
	/* Cardinality labels appear after lines draw */
	.chen-diamond.animate-in :global(text:not(.diamond-label)) {
		animation: fadeIn 0.3s ease 0.9s forwards;
		opacity: 0;
	}

	/* === Dying: lines retract from diamond, then diamond shrinks === */
	@keyframes diamondShrink {
		from { opacity: 1; transform: scale(1); }
		to   { opacity: 0; transform: scale(0); }
	}
	@keyframes fadeOut {
		from { opacity: 1; }
		to   { opacity: 0; }
	}

	.chen-diamond.dying { pointer-events: none; }

	/* Diamond shrinks AFTER lines finish retracting */
	.chen-diamond.dying :global(.diamond-shape) {
		animation: diamondShrink 0.3s ease-in 0.6s forwards;
		transform-origin: center;
		transform-box: fill-box;
	}
	/* Name text fades with diamond */
	.chen-diamond.dying :global(.diamond-label) {
		animation: fadeOut 0.2s ease-in 0.6s forwards;
	}
	/* Cardinality labels fade immediately */
	.chen-diamond.dying :global(text:not(.diamond-label)) {
		animation: fadeOut 0.3s ease-in forwards;
	}
</style>
