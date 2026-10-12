<script lang="ts">
 import EREndpointHandles from './EREndpointHandles.svelte';
 import ERSegmentHandles from './ERSegmentHandles.svelte';
 import DraggableLabel from './DraggableLabel.svelte';
 import { diagram } from '$lib/stores/diagram.svelte';
 import EditableRelationshipText from './EditableRelationshipText.svelte';
	import type { Relationship, CardinalityType } from '$lib/types/er';
	import type { ConnectionPoint, Rect } from '$lib/types/geometry';
	import type { NotationRenderer } from '$lib/renderers/types';
	import type { FlowNode } from '$lib/types/flowchart';
	import { getFlowEdgeRoute } from '$lib/utils/flow-routing';
	import { theme } from '$lib/stores/theme.svelte';
	import { createOrthogonalPath, getOrthogonalMidpoint, crowsFootFork, crowsFootInnerBar, crowsFootOuterBar, crowsFootCircle } from '$lib/renderers/shared/svg-utils';

	let {
		relationship,
		fromPoint,
		toPoint,
		fromRect,
		toRect,
		obstacles = [],
		renderer,
		notation,
		selected = false,
		highlighted = false,
		animateIn = false,
		dimmed = false,
		dying = false,
		onclick,
		ontouchstart
	}: {
		relationship: Relationship;
		fromPoint: ConnectionPoint;
		toPoint: ConnectionPoint;
		fromRect: Rect;
		toRect: Rect;
		obstacles?: FlowNode[];
		renderer: NotationRenderer;
		notation: string;
		selected?: boolean;
		highlighted?: boolean;
		animateIn?: boolean;
		dimmed?: boolean;
		dying?: boolean;
		onclick?: (e: MouseEvent) => void;
		ontouchstart?: (e: TouchEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);
	const stroke = $derived(selected ? colors.selectedStroke : highlighted ? '#3b82f6' : theme.erColorful ? theme.erAccent(relationship.entityIds[0]) : colors.relationshipStroke);
	const strokeWidth = $derived(selected ? 2 : highlighted ? 2.5 : 1.2);
	const dashArray = $derived(renderer.getStrokeDashArray(relationship));

	const route = $derived.by(() => {
		const node = (id: string, rect: Rect): FlowNode => ({ id, name: '', type: 'process', position: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, width: rect.width, height: rect.height });
		return getFlowEdgeRoute({ waypoints: relationship.waypoints }, node(relationship.entityIds[0], fromRect), node(relationship.entityIds[1], toRect), 0, obstacles, { fp: fromPoint, tp: toPoint, fromSide: fromPoint.side, toSide: toPoint.side });
	});
	const path = $derived(route.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '));
	const mid = $derived.by(() => {
		let longest = -1;
		let point = { x: 0, y: 0 };
		for (let i = 1; i < route.length; i++) {
			const a = route[i - 1], b = route[i];
			const length = Math.hypot(b.x - a.x, b.y - a.y);
			if (length > longest) { longest = length; point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
		}
		return point;
	});


	let pathEl: SVGPathElement | undefined = $state();
	let pathLength = $state(0);
	$effect(() => {
		void path;
		if (pathEl) {
			pathLength = pathEl.getTotalLength();
		}
	});


	const fromLabelOffset = $derived(getLabelPosition(fromPoint, 20));
	const toLabelOffset = $derived(getLabelPosition(toPoint, 20));
	const nameLen = $derived(relationship.name.length * 7 + 16);

	function getLabelPosition(point: ConnectionPoint, dist: number): { x: number; y: number } {
		switch (point.side) {
			case 'left': return { x: point.x - dist, y: point.y - 10 };
			case 'right': return { x: point.x + dist, y: point.y - 10 };
			case 'top': return { x: point.x + 10, y: point.y - dist };
			case 'bottom': return { x: point.x + 10, y: point.y + dist + 10 };
		}
	}

	function isCrowsFoot(n: string): boolean {
		return n === 'crows-foot';
	}


	function isMany(c: CardinalityType): boolean {
		return c === 'N' || c === 'M' || c === '0..N' || c === '1..N';
	}


	function isOptional(c: CardinalityType): boolean {
		return c === '0..1' || c === '0..N' || c === 'M';
	}

	function cardinalityLabel(c: CardinalityType): string {
		return renderer.formatCardinality(c);
	}
</script>

<g
	class="relationship-edge"
	class:selected
	class:animate-in={animateIn}
	class:dimmed
	class:dying
	role="button"
	tabindex="0"
	onclick={onclick}
	{ontouchstart}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: pointer; --path-length: {pathLength};"
>

	<path d={path} fill="none" stroke="transparent" stroke-width="14" />


	<path
		bind:this={pathEl}
		d={path}
		fill="none"
		stroke={stroke}
		stroke-width={strokeWidth}
		stroke-dasharray={dashArray}
		marker-end={renderer.useArrowMarkers ? `url(#arrow-${selected ? 'selected' : 'default'})` : undefined}
		class:line-draw={animateIn && pathLength > 0}
		class:line-undraw={dying && pathLength > 0}
		style={animateIn && pathLength > 0 ? `stroke-dasharray: ${pathLength}; stroke-dashoffset: ${pathLength};` : animateIn ? 'visibility: hidden;' : dying && pathLength > 0 ? `stroke-dasharray: ${pathLength}; stroke-dashoffset: 0;` : ''}
	/>


	{#if selected}<ERSegmentHandles {relationship} {route} rects={[fromRect, toRect, ...obstacles.map(n => ({ x: n.position.x - (n.width || 140) / 2, y: n.position.y - (n.height || 60) / 2, width: n.width || 140, height: n.height || 60 }))]} />{/if}

	{#if isCrowsFoot(notation)}


		<DraggableLabel offset={relationship.fromCardinalityOffset} onchange={(offset) => diagram.updateRelationship(relationship.id, { fromCardinalityOffset: offset })}>
{#if isMany(relationship.cardinalities[0])}
			<path class="cf-symbol" d={crowsFootFork(fromPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{:else}
			<path class="cf-symbol" d={crowsFootInnerBar(fromPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{/if}

		{#if isOptional(relationship.cardinalities[0])}
			{@const c = crowsFootCircle(fromPoint)}
			<circle cx={c.cx} cy={c.cy} r={c.r} fill={colors.canvasBg} stroke={stroke} stroke-width="1.2" />
		{:else}
			<path class="cf-symbol" d={crowsFootOuterBar(fromPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{/if}
 </DraggableLabel>



		<DraggableLabel offset={relationship.toCardinalityOffset} onchange={(offset) => diagram.updateRelationship(relationship.id, { toCardinalityOffset: offset })}>
{#if isMany(relationship.cardinalities[1])}
			<path class="cf-symbol" d={crowsFootFork(toPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{:else}
			<path class="cf-symbol" d={crowsFootInnerBar(toPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{/if}

		{#if isOptional(relationship.cardinalities[1])}
			{@const c = crowsFootCircle(toPoint)}
			<circle cx={c.cx} cy={c.cy} r={c.r} fill={colors.canvasBg} stroke={stroke} stroke-width="1.2" />
		{:else}
			<path class="cf-symbol" d={crowsFootOuterBar(toPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{/if}
 </DraggableLabel>
	{/if}


	{#if renderer.showCardinalityText}
		<DraggableLabel offset={relationship.fromCardinalityOffset} onchange={(offset) => diagram.updateRelationship(relationship.id, { fromCardinalityOffset: offset })}>
<text
			x={fromLabelOffset.x}
			y={fromLabelOffset.y}
			text-anchor="middle"
			font-size="12"
			font-weight="700"
			fill={colors.cardinalityText}
		>
			{cardinalityLabel(relationship.cardinalities[0])}
		</text>
 </DraggableLabel>
		<DraggableLabel offset={relationship.toCardinalityOffset} onchange={(offset) => diagram.updateRelationship(relationship.id, { toCardinalityOffset: offset })}>
<text
			x={toLabelOffset.x}
			y={toLabelOffset.y}
			text-anchor="middle"
			font-size="12"
			font-weight="700"
			fill={colors.cardinalityText}
		>
			{cardinalityLabel(relationship.cardinalities[1])}
		</text>
 </DraggableLabel>
	{/if}


	{#if relationship.name.trim()}
 <DraggableLabel anchor={mid} {route} offset={relationship.labelOffset} onchange={(labelOffset) => diagram.updateRelationship(relationship.id, { labelOffset })}>
	{#if renderer.useOvalRelationshipLabel}
		{@const ovalRx = Math.max(nameLen / 2, 40)}
		<ellipse
			cx={mid.x}
			cy={mid.y}
			rx={ovalRx}
			ry="18"
			fill={colors.entityFill}
			stroke={stroke}
			stroke-width="1.2"
		/>
		<EditableRelationshipText {relationship} x={mid.x - nameLen / 2} y={mid.y - 10} width={nameLen} height={20} fontSize={renderer.useOvalRelationshipLabel ? 12 : 11}><text
			x={mid.x}
			y={mid.y}
			text-anchor="middle"
			dominant-baseline="central"
			font-size="12"
			fill={colors.relationshipText}
			font-weight="600"
		>
			{relationship.name}
		</text></EditableRelationshipText>
	{:else}
		<rect
			x={mid.x - nameLen / 2}
			y={mid.y - 10}
			width={nameLen}
			height="20"
			rx="3"
			fill={colors.entityFill}
			stroke={stroke}
			stroke-width="1"
		/>
		<EditableRelationshipText {relationship} x={mid.x - nameLen / 2} y={mid.y - 10} width={nameLen} height={20} fontSize={renderer.useOvalRelationshipLabel ? 12 : 11}><text
			x={mid.x}
			y={mid.y}
			text-anchor="middle"
			dominant-baseline="central"
			font-size="11"
			fill={colors.relationshipText}
			font-weight="600"
		>
			{relationship.name}
		</text></EditableRelationshipText>
	{/if}
 </DraggableLabel>
	{/if}
{#if selected}<EREndpointHandles {relationship} {fromPoint} {toPoint} {fromRect} {toRect} />{/if}
</g>

<style>
 .relationship-edge:has(:global(input[data-editor-relationship])) { animation: none; filter: none; }
 .relationship-edge:has(:global(input[data-editor-relationship])) > rect,
 .relationship-edge:has(:global(input[data-editor-relationship])) > ellipse { stroke: var(--ui-border); }

	@keyframes lineDraw {
		to { stroke-dashoffset: 0; }
	}
	.line-draw {
		animation: lineDraw 0.6s ease-out forwards;
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.relationship-edge.animate-in :global(text),
	.relationship-edge.animate-in :global(circle),
	.relationship-edge.animate-in :global(.cf-symbol),
	.relationship-edge.animate-in :global(rect),
	.relationship-edge.animate-in :global(ellipse) {
		animation: fadeIn 0.3s ease 0.6s forwards;
		opacity: 0;
	}
	@keyframes selectionPulse {
		0%, 100% { filter: drop-shadow(0 0 4px rgba(59,130,246,0.3)); }
		50% { filter: drop-shadow(0 0 10px rgba(59,130,246,0.6)); }
	}
	@keyframes lineUndraw {
		to { stroke-dashoffset: var(--path-length); }
	}
	.line-undraw {
		animation: lineUndraw 0.6s ease-in forwards;
	}
	@keyframes edgeLabelDie {
		from { opacity: 1; }
		to { opacity: 0; }
	}
	.relationship-edge { transition: filter 0.15s ease, opacity 0.3s ease; }
	.relationship-edge.selected { animation: selectionPulse 2s ease-in-out infinite; }
	.relationship-edge:hover { filter: drop-shadow(0 0 3px rgba(59,130,246,0.3)); }
	.relationship-edge.dimmed { opacity: 0.15; filter: grayscale(0.5); pointer-events: none; }
	.relationship-edge.dying { pointer-events: none; }
	.relationship-edge.dying :global(text),
	.relationship-edge.dying :global(circle),
	.relationship-edge.dying :global(.cf-symbol),
	.relationship-edge.dying :global(rect),
	.relationship-edge.dying :global(ellipse) {
		animation: edgeLabelDie 0.3s ease-in forwards;
	}
</style>
