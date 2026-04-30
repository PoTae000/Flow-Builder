<script lang="ts">
	import type { DFDFlow } from '$lib/types/context-diagram';
	import type { DFDNode } from '$lib/types/context-diagram';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		flow,
		fromNode,
		toNode,
		offset = 0,
		selected = false,
		onclick
	}: {
		flow: DFDFlow;
		fromNode: DFDNode;
		toNode: DFDNode;
		offset?: number;
		selected?: boolean;
		onclick?: () => void;
	} = $props();

	const colors = $derived(theme.colors);

	// Calculate perpendicular offset for parallel flows
	const offsetPoints = $derived.by(() => {
		const baseX1 = fromNode.position.x;
		const baseY1 = fromNode.position.y;
		const baseX2 = toNode.position.x;
		const baseY2 = toNode.position.y;

		if (offset === 0) {
			return { x1: baseX1, y1: baseY1, x2: baseX2, y2: baseY2, mx: (baseX1 + baseX2) / 2, my: (baseY1 + baseY2) / 2 };
		}

		// Calculate perpendicular direction
		const dx = baseX2 - baseX1;
		const dy = baseY2 - baseY1;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length === 0) return { x1: baseX1, y1: baseY1, x2: baseX2, y2: baseY2, mx: baseX1, my: baseY1 };

		// Perpendicular unit vector: rotate 90 degrees
		const perpX = -dy / length;
		const perpY = dx / length;

		// Apply offset
		const x1 = baseX1 + perpX * offset;
		const y1 = baseY1 + perpY * offset;
		const x2 = baseX2 + perpX * offset;
		const y2 = baseY2 + perpY * offset;
		const mx = (x1 + x2) / 2;
		const my = (y1 + y2) / 2;

		return { x1, y1, x2, y2, mx, my };
	});
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
		x1={offsetPoints.x1}
		y1={offsetPoints.y1}
		x2={offsetPoints.x2}
		y2={offsetPoints.y2}
		stroke="transparent"
		stroke-width="12"
	/>

	<!-- Visible line -->
	<line
		x1={offsetPoints.x1}
		y1={offsetPoints.y1}
		x2={offsetPoints.x2}
		y2={offsetPoints.y2}
		stroke={selected ? colors.selectedStroke : colors.relationshipStroke}
		stroke-width={selected ? 2 : 1.5}
		marker-end="url(#dfd-arrow)"
	/>

	<!-- Label -->
	{#if flow.label}
		<rect
			x={offsetPoints.mx - flow.label.length * 3.5 - 4}
			y={offsetPoints.my - 10}
			width={flow.label.length * 7 + 8}
			height={20}
			fill={colors.entityFill}
			rx="3"
		/>
		<text
			x={offsetPoints.mx}
			y={offsetPoints.my}
			text-anchor="middle"
			dominant-baseline="central"
			fill={colors.relationshipText}
			font-size="11"
		>
			{flow.label}
		</text>
	{/if}
</g>
