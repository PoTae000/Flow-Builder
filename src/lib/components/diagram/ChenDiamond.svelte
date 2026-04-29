<script lang="ts">
	import type { Relationship } from '$lib/types/er';
	import type { ConnectionPoint } from '$lib/types/geometry';
	import type { NotationRenderer } from '$lib/renderers/types';
	import { theme } from '$lib/stores/theme.svelte';
	import { createDiamond } from '$lib/renderers/shared/svg-utils';

	let {
		relationship,
		fromPoint,
		toPoint,
		renderer,
		selected = false,
		highlighted = false,
		animateIn = false,
		onclick
	}: {
		relationship: Relationship;
		fromPoint: ConnectionPoint;
		toPoint: ConnectionPoint;
		renderer: NotationRenderer;
		selected?: boolean;
		highlighted?: boolean;
		animateIn?: boolean;
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);
	const midX = $derived((fromPoint.x + toPoint.x) / 2);
	const midY = $derived((fromPoint.y + toPoint.y) / 2);
	const diamondW = 90;
	const diamondH = 44;

	const diamondPath = $derived(createDiamond(midX, midY, diamondW, diamondH));

	// Diamond has 4 connection points (top, right, bottom, left)
	const diamondPoints = $derived({
		top: { x: midX, y: midY - diamondH / 2 },
		right: { x: midX + diamondW / 2, y: midY },
		bottom: { x: midX, y: midY + diamondH / 2 },
		left: { x: midX - diamondW / 2, y: midY }
	});

	// Find best diamond connection point for each entity
	function bestDiamondPoint(entityPt: ConnectionPoint): { x: number; y: number } {
		const pts = [diamondPoints.top, diamondPoints.right, diamondPoints.bottom, diamondPoints.left];
		let best = pts[0];
		let bestDist = Infinity;
		for (const p of pts) {
			const d = Math.hypot(p.x - entityPt.x, p.y - entityPt.y);
			if (d < bestDist) {
				bestDist = d;
				best = p;
			}
		}
		return best;
	}

	const fromDiamondPt = $derived(bestDiamondPoint(fromPoint));
	const toDiamondPt = $derived(bestDiamondPoint(toPoint));

	const pathFrom = $derived(`M ${fromPoint.x} ${fromPoint.y} L ${fromDiamondPt.x} ${fromDiamondPt.y}`);
	const pathTo = $derived(`M ${toDiamondPt.x} ${toDiamondPt.y} L ${toPoint.x} ${toPoint.y}`);

	// Cardinality label positions (midpoint of entity-to-diamond line segment, offset above)
	const fromLabelPos = $derived({
		x: (fromPoint.x + fromDiamondPt.x) / 2,
		y: (fromPoint.y + fromDiamondPt.y) / 2 - 10
	});
	const toLabelPos = $derived({
		x: (toPoint.x + toDiamondPt.x) / 2,
		y: (toPoint.y + toDiamondPt.y) / 2 - 10
	});

	const stroke = $derived(selected ? colors.selectedStroke : colors.chenDiamondStroke);
</script>

<g
	class="chen-diamond"
	class:animate-in={animateIn}
	role="button"
	tabindex="0"
	onclick={onclick}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: pointer;"
>
	<!-- Hit area lines -->
	<path d={pathFrom} fill="none" stroke="transparent" stroke-width="10" />
	<path d={pathTo} fill="none" stroke="transparent" stroke-width="10" />

	<!-- Lines from entities to diamond -->
	<path d={pathFrom} fill="none" stroke={colors.relationshipStroke} stroke-width="1.2"
		class:line-draw={animateIn}
		style={animateIn ? 'stroke-dasharray: 2000; stroke-dashoffset: 2000;' : ''} />
	<path d={pathTo} fill="none" stroke={colors.relationshipStroke} stroke-width="1.2"
		class:line-draw={animateIn}
		style={animateIn ? 'stroke-dasharray: 2000; stroke-dashoffset: 2000;' : ''} />

	<!-- Selection highlight -->
	{#if selected}
		<path
			d={createDiamond(midX, midY, diamondW + 6, diamondH + 6)}
			fill="none"
			stroke={colors.selectedStroke}
			stroke-width="2.5"
			opacity="0.4"
		/>
	{/if}

	<!-- SQL Visualizer highlight -->
	{#if highlighted}
		<path
			d={createDiamond(midX, midY, diamondW + 10, diamondH + 10)}
			fill="none"
			stroke="#3b82f6"
			stroke-width="2"
			stroke-dasharray="6 3"
			opacity="0.7"
		/>
	{/if}

	<!-- Double diamond for identifying relationship -->
	{#if relationship.isIdentifying}
		<path
			d={createDiamond(midX, midY, diamondW - 10, diamondH - 10)}
			fill="none"
			stroke={colors.chenDiamondStroke}
			stroke-width="1.2"
		/>
	{/if}

	<!-- Diamond fill + border -->
	<path
		d={diamondPath}
		fill={colors.chenDiamondFill}
		stroke={stroke}
		stroke-width="1.2"
	/>

	<!-- Relationship name -->
	<text
		x={midX}
		y={midY}
		text-anchor="middle"
		dominant-baseline="central"
		font-size="11"
		fill={colors.relationshipText}
		font-weight="600"
	>
		{relationship.name}
	</text>

	<!-- Cardinality labels -->
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
</g>

<style>
	@keyframes lineDraw {
		to { stroke-dashoffset: 0; }
	}
	.line-draw {
		animation: lineDraw 0.6s ease-out forwards;
	}
	@keyframes diamondAppear {
		from { opacity: 0; transform: scale(0.8); }
		to { opacity: 1; transform: scale(1); }
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.chen-diamond.animate-in :global(path:not(.line-draw)) {
		animation: diamondAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		transform-origin: center;
		transform-box: fill-box;
	}
	.chen-diamond.animate-in :global(text) {
		animation: fadeIn 0.3s ease 0.3s forwards;
		opacity: 0;
	}
</style>
