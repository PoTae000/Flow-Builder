<script lang="ts">
	import type { Relationship, CardinalityType } from '$lib/types/er';
	import type { ConnectionPoint, Rect } from '$lib/types/geometry';
	import type { NotationRenderer } from '$lib/renderers/types';
	import { theme } from '$lib/stores/theme.svelte';
	import { createOrthogonalPath, getOrthogonalMidpoint, crowsFootFork, crowsFootInnerBar, crowsFootOuterBar, crowsFootCircle } from '$lib/renderers/shared/svg-utils';

	let {
		relationship,
		fromPoint,
		toPoint,
		fromRect,
		toRect,
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
	const stroke = $derived(selected ? colors.selectedStroke : highlighted ? '#3b82f6' : colors.relationshipStroke);
	const strokeWidth = $derived(selected ? 2 : highlighted ? 2.5 : 1.2);

	const path = $derived(createOrthogonalPath(fromPoint, toPoint));
	const mid = $derived(getOrthogonalMidpoint(fromPoint, toPoint));

	// Path length for draw/undraw animation
	let pathEl: SVGPathElement | undefined = $state();
	let pathLength = $state(0);
	$effect(() => {
		void path;
		if (pathEl) {
			pathLength = pathEl.getTotalLength();
		}
	});

	// Cardinality label positions (near each entity, offset from line)
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

	// Slot 1: fork for many, bar for one
	function isMany(c: CardinalityType): boolean {
		return c === 'N' || c === 'M' || c === '0..N' || c === '1..N';
	}

	// Slot 2: circle for optional, bar for mandatory
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
	<!-- Hit area -->
	<path d={path} fill="none" stroke="transparent" stroke-width="14" />

	<!-- Main line -->
	<path
		bind:this={pathEl}
		d={path}
		fill="none"
		stroke={stroke}
		stroke-width={strokeWidth}
		marker-end={renderer.useArrowMarkers ? `url(#arrow-${selected ? 'selected' : 'default'})` : undefined}
		class:line-draw={animateIn && pathLength > 0}
		class:line-undraw={dying && pathLength > 0}
		style={animateIn && pathLength > 0 ? `stroke-dasharray: ${pathLength}; stroke-dashoffset: ${pathLength};` : animateIn ? 'visibility: hidden;' : dying && pathLength > 0 ? `stroke-dasharray: ${pathLength}; stroke-dashoffset: 0;` : ''}
	/>

	<!-- Crow's Foot notation symbols -->
	{#if isCrowsFoot(notation)}
		<!-- From side -->
		<!-- Slot 1 (closest to entity): fork for many, bar for one -->
		{#if isMany(relationship.cardinalities[0])}
			<path class="cf-symbol" d={crowsFootFork(fromPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{:else}
			<path class="cf-symbol" d={crowsFootInnerBar(fromPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{/if}
		<!-- Slot 2 (further from entity): circle for optional, bar for mandatory -->
		{#if isOptional(relationship.cardinalities[0])}
			{@const c = crowsFootCircle(fromPoint)}
			<circle cx={c.cx} cy={c.cy} r={c.r} fill={colors.canvasBg} stroke={stroke} stroke-width="1.2" />
		{:else}
			<path class="cf-symbol" d={crowsFootOuterBar(fromPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{/if}

		<!-- To side -->
		<!-- Slot 1 -->
		{#if isMany(relationship.cardinalities[1])}
			<path class="cf-symbol" d={crowsFootFork(toPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{:else}
			<path class="cf-symbol" d={crowsFootInnerBar(toPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{/if}
		<!-- Slot 2 -->
		{#if isOptional(relationship.cardinalities[1])}
			{@const c = crowsFootCircle(toPoint)}
			<circle cx={c.cx} cy={c.cy} r={c.r} fill={colors.canvasBg} stroke={stroke} stroke-width="1.2" />
		{:else}
			<path class="cf-symbol" d={crowsFootOuterBar(toPoint)} fill="none" stroke={stroke} stroke-width="1.2" />
		{/if}
	{/if}

	<!-- Cardinality text labels (only for notations that use text) -->
	{#if renderer.showCardinalityText}
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
	{/if}

	<!-- Relationship name in the middle -->
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
		<text
			x={mid.x}
			y={mid.y}
			text-anchor="middle"
			dominant-baseline="central"
			font-size="12"
			fill={colors.relationshipText}
			font-weight="600"
		>
			{relationship.name}
		</text>
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
		<text
			x={mid.x}
			y={mid.y}
			text-anchor="middle"
			dominant-baseline="central"
			font-size="11"
			fill={colors.relationshipText}
			font-weight="600"
		>
			{relationship.name}
		</text>
	{/if}
</g>

<style>
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
