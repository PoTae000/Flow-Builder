<script lang="ts">
	import type { DFDFlow } from '$lib/types/context-diagram';
	import type { DFDNode } from '$lib/types/context-diagram';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		flow,
		fromNode,
		toNode,
		selected = false,
		onclick
	}: {
		flow: DFDFlow;
		fromNode: DFDNode;
		toNode: DFDNode;
		selected?: boolean;
		onclick?: () => void;
	} = $props();

	const colors = $derived(theme.colors);

	const x1 = $derived(fromNode.position.x);
	const y1 = $derived(fromNode.position.y);
	const x2 = $derived(toNode.position.x);
	const y2 = $derived(toNode.position.y);
	const mx = $derived((x1 + x2) / 2);
	const my = $derived((y1 + y2) / 2);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<g
	class="dfd-flow"
	class:selected
	{onclick}
	style="cursor: pointer;"
>
	<!-- Hit area -->
	<line
		{x1} {y1} {x2} {y2}
		stroke="transparent"
		stroke-width="12"
	/>

	<!-- Visible line -->
	<line
		{x1} {y1} {x2} {y2}
		stroke={selected ? colors.selectedStroke : colors.relationshipStroke}
		stroke-width={selected ? 2 : 1.5}
		marker-end="url(#dfd-arrow)"
	/>

	<!-- Label -->
	{#if flow.label}
		<rect
			x={mx - flow.label.length * 3.5 - 4}
			y={my - 10}
			width={flow.label.length * 7 + 8}
			height={20}
			fill={colors.entityFill}
			rx="3"
		/>
		<text
			x={mx}
			y={my}
			text-anchor="middle"
			dominant-baseline="central"
			fill={colors.relationshipText}
			font-size="11"
		>
			{flow.label}
		</text>
	{/if}
</g>
