<script lang="ts">
	import type { FlowNode } from '$lib/types/flowchart';
	import type { Position } from '$lib/types/geometry';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		node,
		selected = false,
		onmousedown,
		onclick,
		ontouchstart,
		oncontextmenu
	}: {
		node: FlowNode;
		selected?: boolean;
		onmousedown?: (e: MouseEvent) => void;
		onclick?: (e: MouseEvent) => void;
		ontouchstart?: (e: TouchEvent) => void;
		oncontextmenu?: (e: MouseEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);

	const W = 140;
	const H = 60;
	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
	class="flow-node"
	class:selected
	role="button"
	tabindex="0"
	aria-label="Flow node: {node.name}"
	{onmousedown}
	{onclick}
	{ontouchstart}
	{oncontextmenu}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: grab;"
>
	<!-- Selection highlight -->
	{#if selected}
		<rect
			x={cx - W / 2 - 2}
			y={cy - H / 2 - 2}
			width={W + 4}
			height={H + 4}
			rx={node.type === 'start-end' || node.type === 'connector' || node.type === 'delay' ? 22 : 2}
			fill="none"
			stroke={colors.selectedStroke}
			stroke-width="2.5"
			opacity="0.5"
		/>
	{/if}

	<!-- Shape by type -->
	{#if node.type === 'start-end'}
		<!-- Rounded rectangle (stadium) -->
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			rx="20"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'process'}
		<!-- Rectangle -->
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'decision'}
		<!-- Diamond -->
		<polygon
			points="{cx},{cy - H / 2 - 5} {cx + W / 2 + 10},{cy} {cx},{cy + H / 2 + 5} {cx - W / 2 - 10},{cy}"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'input-output'}
		<!-- Parallelogram -->
		<polygon
			points="{cx - W / 2 + 15},{cy - H / 2} {cx + W / 2},{cy - H / 2} {cx + W / 2 - 15},{cy + H / 2} {cx - W / 2},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'connector'}
		<!-- Circle -->
		<circle
			cx={cx}
			cy={cy}
			r="25"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'document'}
		<!-- Rectangle with wavy bottom -->
		<path
			d="M{cx - W / 2},{cy - H / 2}
			   h{W}
			   v{H - 10}
			   q{-W / 4},{10} {-W / 2},{0}
			   q{-W / 4},{-10} {-W / 2},{0}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'database'}
		<!-- Cylinder -->
		<path
			d="M{cx - W / 2},{cy - H / 2 + 10}
			   a{W / 2},{10} 0 0,1 {W},{0}
			   v{H - 20}
			   a{W / 2},{10} 0 0,1 {-W},{0}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
		<!-- Top ellipse -->
		<ellipse
			cx={cx}
			cy={cy - H / 2 + 10}
			rx={W / 2}
			ry="10"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'predefined-process'}
		<!-- Rectangle with double vertical lines -->
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
		<line
			x1={cx - W / 2 + 10}
			y1={cy - H / 2}
			x2={cx - W / 2 + 10}
			y2={cy + H / 2}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
		<line
			x1={cx + W / 2 - 10}
			y1={cy - H / 2}
			x2={cx + W / 2 - 10}
			y2={cy + H / 2}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'manual-operation'}
		<!-- Inverted trapezoid -->
		<polygon
			points="{cx - W / 2},{cy - H / 2} {cx + W / 2},{cy - H / 2} {cx + W / 2 - 15},{cy + H / 2} {cx - W / 2 + 15},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'preparation'}
		<!-- Hexagon -->
		<polygon
			points="{cx - W / 2 + 20},{cy - H / 2} {cx + W / 2 - 20},{cy - H / 2} {cx + W / 2},{cy} {cx + W / 2 - 20},{cy + H / 2} {cx - W / 2 + 20},{cy + H / 2} {cx - W / 2},{cy}"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'delay'}
		<!-- D-shape: flat left, rounded right -->
		<path
			d="M{cx - W / 2},{cy - H / 2}
			   h{W - H / 2}
			   a{H / 2},{H / 2} 0 0,1 0,{H}
			   h{-(W - H / 2)}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'display'}
		<!-- Pointed left, rounded right -->
		<path
			d="M{cx - W / 2 + 15},{cy - H / 2}
			   h{W - 15 - H / 2}
			   a{H / 2},{H / 2} 0 0,1 0,{H}
			   h{-(W - 15 - H / 2)}
			   l{-15},{-H / 2}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
	{:else if node.type === 'internal-storage'}
		<!-- Rectangle with cross lines at top-left corner -->
		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1.5"
		/>
		<line
			x1={cx - W / 2 + 12}
			y1={cy - H / 2}
			x2={cx - W / 2 + 12}
			y2={cy + H / 2}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1"
		/>
		<line
			x1={cx - W / 2}
			y1={cy - H / 2 + 12}
			x2={cx + W / 2}
			y2={cy - H / 2 + 12}
			stroke={selected ? colors.selectedStroke : colors.entityStroke}
			stroke-width="1"
		/>
	{/if}

	<!-- Label -->
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
</g>
