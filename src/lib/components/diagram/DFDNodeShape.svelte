<script lang="ts">
	import type { DFDNode } from '$lib/types/context-diagram';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		node,
		selected = false,
		animateIn = false,
		dying = false,
		onmousedown,
		onclick,
		ontouchstart,
		oncontextmenu,
		ondblclick
	}: {
		node: DFDNode;
		selected?: boolean;
		animateIn?: boolean;
		dying?: boolean;
		onmousedown?: (e: MouseEvent) => void;
		onclick?: (e: MouseEvent) => void;
		ontouchstart?: (e: TouchEvent) => void;
		oncontextmenu?: (e: MouseEvent) => void;
		ondblclick?: (e: MouseEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);
	const accent = $derived(theme.erColorful ? theme.erAccent(node.id) : colors.entityStroke);
	const bodyFill = $derived(node.color || (theme.erColorful ? (theme.isDark ? '#18202e' : '#ffffff') : colors.entityFill));

	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
	class="dfd-node"
	class:selected
	class:animate-in={animateIn}
	class:dying
	role="button"
	tabindex="0"
	aria-label="DFD node: {node.name}"
	{onmousedown}
	{onclick}
	{ontouchstart}
	{oncontextmenu}
	{ondblclick}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: grab;"
>
	{#if node.type === 'process'}

		{@const W = node.width ?? 140}
		{@const headerH = node.processNumber ? 28 : 0}
		{@const bodyH = (node.height ?? (headerH + 50)) - headerH}
		{@const H = headerH + bodyH}
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			rx="3"
			fill={bodyFill}
			stroke={selected ? colors.selectedStroke : accent}
			stroke-width="1.5" pathLength="100"
		/>

		{#if theme.erColorful}
			<rect x={cx - W / 2 + 1} y={cy - H / 2 + 1} width={W - 2} height={(headerH || H) - 2} rx="2" fill={accent} opacity={theme.isDark ? 0.2 : 0.16} pointer-events="none" />
		{/if}
		{#if node.processNumber}
			<line
				x1={cx - W / 2}
				y1={cy - H / 2 + headerH}
				x2={cx + W / 2}
				y2={cy - H / 2 + headerH}
				stroke={selected ? colors.selectedStroke : accent}
				stroke-width="1.5" pathLength="100"
			/>
			<text
				x={cx}
				y={cy - H / 2 + headerH / 2}
				text-anchor="middle"
				dominant-baseline="central"
				fill={colors.pkColor}
				font-size="12"
				font-weight="700"
			>
				{node.processNumber}
			</text>
		{/if}

		<text
			x={cx}
			y={cy - H / 2 + headerH + bodyH / 2}
			text-anchor="middle"
			dominant-baseline="central"
			fill={colors.entityHeaderText}
			font-size="13"
			font-weight="600"
		>
			{node.name}
		</text>

	{:else if node.type === 'external-entity'}

		{@const W = node.width ?? 120}
		{@const H = node.height ?? 50}
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={bodyFill}
			stroke={selected ? colors.selectedStroke : accent}
			stroke-width="1.5" pathLength="100"
		/>
		{#if theme.erColorful}<rect x={cx - W / 2 + 1} y={cy - H / 2 + 1} width={W - 2} height={H - 2} fill={accent} opacity={theme.isDark ? 0.2 : 0.16} pointer-events="none" />{/if}
		<text
			x={cx}
			y={cy}
			text-anchor="middle"
			dominant-baseline="central"
			fill={colors.entityHeaderText}
			font-size="13"
			font-weight="600"
		>
			{node.name}
		</text>

	{:else if node.type === 'data-store'}

		{@const W = node.width ?? 140}
		{@const H = node.height ?? 40}
		{@const idColW = 36}
		{@const strokeColor = selected ? colors.selectedStroke : accent}

		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={bodyFill}
			stroke="none"
		/>
		{#if theme.erColorful}<rect x={cx - W / 2} y={cy - H / 2} width={idColW} height={H} fill={accent} opacity={theme.isDark ? 0.2 : 0.16} pointer-events="none" />{/if}

		<line x1={cx - W / 2} y1={cy - H / 2} x2={cx + W / 2} y2={cy - H / 2} stroke={strokeColor} stroke-width="1.5" pathLength="100" />

		<line x1={cx - W / 2} y1={cy + H / 2} x2={cx + W / 2} y2={cy + H / 2} stroke={strokeColor} stroke-width="1.5" pathLength="100" />

		<line x1={cx - W / 2} y1={cy - H / 2} x2={cx - W / 2} y2={cy + H / 2} stroke={strokeColor} stroke-width="1.5" pathLength="100" />

		<line x1={cx - W / 2 + idColW} y1={cy - H / 2} x2={cx - W / 2 + idColW} y2={cy + H / 2} stroke={strokeColor} stroke-width="1.5" pathLength="100" />

		<text
			x={cx - W / 2 + idColW / 2}
			y={cy}
			text-anchor="middle"
			dominant-baseline="central"
			fill={colors.pkColor}
			font-size="12"
			font-weight="700"
		>
			{node.storeNumber || ''}
		</text>

		<text
			x={cx - W / 2 + idColW + (W - idColW) / 2}
			y={cy}
			text-anchor="middle"
			dominant-baseline="central"
			fill={colors.entityHeaderText}
			font-size="13"
			font-weight="600"
		>
			{node.name}
		</text>
	{/if}
</g>

<style>
	@keyframes nodeAppear {
		from { opacity: 0; transform: scale(0.8); }
		to { opacity: 1; transform: scale(1); }
	}
	.dfd-node.animate-in {
		animation: nodeAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		transform-origin: center;
		transform-box: fill-box;
	}
	/* Dying: undraw the outline following the real DFD shape (process box,
	   external-entity rect, or open-ended data-store) while fill/text fade — the
	   same ER crow-foot delete style. Every geometry element carries pathLength=100
	   so one rule retracts them uniformly. */
	@keyframes dfdShapeUndraw {
		from { stroke-dashoffset: 0; }
		to   { stroke-dashoffset: 100; }
	}
	@keyframes dfdShapeFade {
		from { opacity: 1; }
		to   { opacity: 0; }
	}
	.dfd-node.dying {
		pointer-events: none;
	}
	.dfd-node.dying :is(rect, line) {
		stroke-dasharray: 100;
		animation:
			dfdShapeUndraw 0.6s ease-in forwards,
			dfdShapeFade 0.45s ease-in forwards;
	}
	.dfd-node.dying text {
		animation: dfdShapeFade 0.35s ease-in forwards;
	}
	.dfd-node { transition: filter 0.15s ease; }
	.dfd-node:hover { filter: drop-shadow(0 0 4px rgba(59,130,246,0.2)); }
</style>
