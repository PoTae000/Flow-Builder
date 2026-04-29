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
		<!-- Circle for process -->
		{#if selected}
			<circle cx={cx} cy={cy} r="42" fill="none" stroke={colors.selectedStroke} stroke-width="2.5" opacity="0.5" />
		{/if}
		<circle
			{cx} {cy}
			r="40"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
		<!-- Process number -->
		{#if node.processNumber}
			<text
				x={cx}
				y={cy - 12}
				text-anchor="middle"
				dominant-baseline="central"
				fill={colors.pkColor}
				font-size="11"
				font-weight="700"
			>
				{node.processNumber}
			</text>
		{/if}
		<text
			x={cx}
			y={node.processNumber ? cy + 6 : cy}
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
		<!-- Open-ended rectangle for data store -->
		{@const W = 140}
		{@const H = 40}
		{#if selected}
			<rect x={cx - W / 2 - 2} y={cy - H / 2 - 2} width={W + 4} height={H + 4} fill="none" stroke={colors.selectedStroke} stroke-width="2.5" opacity="0.5" />
		{/if}
		<!-- Top & bottom lines + left line -->
		<line x1={cx - W / 2} y1={cy - H / 2} x2={cx + W / 2} y2={cy - H / 2} stroke={selected ? colors.selectedStroke : colors.entityStroke} stroke-width="1.5" />
		<line x1={cx - W / 2} y1={cy + H / 2} x2={cx + W / 2} y2={cy + H / 2} stroke={selected ? colors.selectedStroke : colors.entityStroke} stroke-width="1.5" />
		<line x1={cx - W / 2} y1={cy - H / 2} x2={cx - W / 2} y2={cy + H / 2} stroke={selected ? colors.selectedStroke : colors.entityStroke} stroke-width="1.5" />
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke="none"
		/>
		<!-- Redraw borders on top of fill -->
		<line x1={cx - W / 2} y1={cy - H / 2} x2={cx + W / 2} y2={cy - H / 2} stroke={selected ? colors.selectedStroke : colors.entityStroke} stroke-width="1.5" />
		<line x1={cx - W / 2} y1={cy + H / 2} x2={cx + W / 2} y2={cy + H / 2} stroke={selected ? colors.selectedStroke : colors.entityStroke} stroke-width="1.5" />
		<line x1={cx - W / 2} y1={cy - H / 2} x2={cx - W / 2} y2={cy + H / 2} stroke={selected ? colors.selectedStroke : colors.entityStroke} stroke-width="1.5" />
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
