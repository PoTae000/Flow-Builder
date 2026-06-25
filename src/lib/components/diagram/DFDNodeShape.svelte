<script lang="ts">
	import type { DFDNode } from '$lib/types/context-diagram';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		node,
		selected = false,
		animateIn = false,
		onmousedown,
		onclick,
		ontouchstart,
		oncontextmenu
	}: {
		node: DFDNode;
		selected?: boolean;
		animateIn?: boolean;
		onmousedown?: (e: MouseEvent) => void;
		onclick?: (e: MouseEvent) => void;
		ontouchstart?: (e: TouchEvent) => void;
		oncontextmenu?: (e: MouseEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);

	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
	class="dfd-node"
	class:selected
	class:animate-in={animateIn}
	role="button"
	tabindex="0"
	aria-label="DFD node: {node.name}"
	{onmousedown}
	{onclick}
	{ontouchstart}
	{oncontextmenu}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: grab;"
>
	{#if node.type === 'process'}
		<!-- Gane-Sarson rectangle for process -->
		{@const W = 140}
		{@const headerH = node.processNumber ? 28 : 0}
		{@const bodyH = 50}
		{@const H = headerH + bodyH}
		{#if selected}
			<rect x={cx - W / 2 - 2} y={cy - H / 2 - 2} width={W + 4} height={H + 4} rx="4" fill="none" stroke={colors.selectedStroke} stroke-width="2.5" opacity="0.5" />
		{/if}
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			rx="3"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
		<!-- Process number header -->
		{#if node.processNumber}
			<line
				x1={cx - W / 2}
				y1={cy - H / 2 + headerH}
				x2={cx + W / 2}
				y2={cy - H / 2 + headerH}
				stroke={selected ? colors.selectedStroke : colors.entityStroke}
				stroke-width="1.5"
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
		<!-- Process name -->
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
		<!-- Rectangle for external entity -->
		{@const W = 120}
		{@const H = 50}
		{#if selected}
			<rect x={cx - W / 2 - 2} y={cy - H / 2 - 2} width={W + 4} height={H + 4} fill="none" stroke={colors.selectedStroke} stroke-width="2.5" opacity="0.5" />
		{/if}
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
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
		<!-- Open-ended rectangle for data store with ID column -->
		{@const W = 140}
		{@const H = 40}
		{@const idColW = 36}
		{@const strokeColor = selected ? colors.selectedStroke : colors.entityStroke}
		{#if selected}
			<rect x={cx - W / 2 - 2} y={cy - H / 2 - 2} width={W + 4} height={H + 4} fill="none" stroke={colors.selectedStroke} stroke-width="2.5" opacity="0.5" />
		{/if}
		<!-- Fill background -->
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke="none"
		/>
		<!-- Top line -->
		<line x1={cx - W / 2} y1={cy - H / 2} x2={cx + W / 2} y2={cy - H / 2} stroke={strokeColor} stroke-width="1.5" />
		<!-- Bottom line -->
		<line x1={cx - W / 2} y1={cy + H / 2} x2={cx + W / 2} y2={cy + H / 2} stroke={strokeColor} stroke-width="1.5" />
		<!-- Left vertical line -->
		<line x1={cx - W / 2} y1={cy - H / 2} x2={cx - W / 2} y2={cy + H / 2} stroke={strokeColor} stroke-width="1.5" />
		<!-- Divider between ID column and name column -->
		<line x1={cx - W / 2 + idColW} y1={cy - H / 2} x2={cx - W / 2 + idColW} y2={cy + H / 2} stroke={strokeColor} stroke-width="1.5" />
		<!-- Store number (ID column) -->
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
		<!-- Store name (main column) -->
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
	.dfd-node { transition: filter 0.15s ease; }
	.dfd-node:hover { filter: drop-shadow(0 0 4px rgba(59,130,246,0.2)); }
</style>
