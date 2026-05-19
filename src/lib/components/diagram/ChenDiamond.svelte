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
		dying = false,
		onclick
	}: {
		relationship: Relationship;
		fromPoint: ConnectionPoint;
		toPoint: ConnectionPoint;
		renderer: NotationRenderer;
		selected?: boolean;
		highlighted?: boolean;
		animateIn?: boolean;
		dying?: boolean;
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);
	const midX = $derived((fromPoint.x + toPoint.x) / 2);
	const midY = $derived((fromPoint.y + toPoint.y) / 2);
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

	// Paths: diamond → entity direction (dashoffset retracts from diamond side)
	const pathFrom = $derived(`M ${fromDiamondPt.x} ${fromDiamondPt.y} L ${fromPoint.x} ${fromPoint.y}`);
	const pathTo = $derived(`M ${toDiamondPt.x} ${toDiamondPt.y} L ${toPoint.x} ${toPoint.y}`);

	// Distances (= path lengths for straight lines)
	const distFrom = $derived(Math.hypot(fromDiamondPt.x - fromPoint.x, fromDiamondPt.y - fromPoint.y));
	const distTo = $derived(Math.hypot(toPoint.x - toDiamondPt.x, toPoint.y - toDiamondPt.y));

	const DUR = 0.6;
	const DIAMOND_DUR = 0.3;

	// Two-frame trigger for CSS transitions (both dying and animateIn)
	// Frame 1: set initial dashoffset
	// Frame 2: set target dashoffset → transition kicks in
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

	// Line styles based on state
	// Dying: dashoffset 0 → dist (retract from diamond toward entity)
	// AnimateIn: dashoffset dist → 0 (draw from entity toward diamond, delayed after diamond appears)
	function lineStyle(dist: number): string {
		if (dying) {
			return `stroke-dasharray: ${dist}; stroke-dashoffset: ${dyingStep >= 2 ? dist : 0}; transition: stroke-dashoffset ${DUR}s ease-in;`;
		}
		if (animateIn) {
			return `stroke-dasharray: ${dist}; stroke-dashoffset: ${animInStep >= 2 ? 0 : dist}; transition: stroke-dashoffset ${DUR}s ease-out ${DIAMOND_DUR}s;`;
		}
		return '';
	}

	// Position labels perpendicular to the line (beside it, not on top)
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
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
	class="chen-diamond"
	class:animate-in={animateIn}
	class:dying
	role="button"
	tabindex="0"
	onclick={onclick}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: pointer;"
>
	<!-- Hit area -->
	<path d={pathFrom} fill="none" stroke="transparent" stroke-width="10" />
	<path d={pathTo} fill="none" stroke="transparent" stroke-width="10" />

	<!-- Source line (diamond → entity) -->
	<path d={pathFrom} fill="none" stroke={colors.relationshipStroke} stroke-width="1.2"
		style={lineStyle(distFrom)} />
	<!-- Destination line (diamond → entity) -->
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

	<!-- Diamond fill + border -->
	<path
		class="diamond-shape"
		d={diamondPath}
		fill={colors.chenDiamondFill}
		stroke={strokeColor}
		stroke-width="1.2"
	/>

	<!-- Relationship name -->
	<text
		class="diamond-label"
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
