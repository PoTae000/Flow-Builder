<script lang="ts">
	import type { Position } from '$lib/types/geometry';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		edge,
		route,
		onDragWaypoint,
		onAddWaypoint,
		onRemoveWaypoint
	}: {
		edge: { id: string };
		route: Position[];
		onDragWaypoint: (index: number, e: MouseEvent) => void;
		onAddWaypoint: (index: number) => void;
		onRemoveWaypoint: (index: number) => void;
	} = $props();

	const colors = $derived(theme.colors);
</script>

<!-- Waypoint handles (middle points of route) -->
{#each route as point, i}
	{#if i > 0 && i < route.length - 1}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<g>
			<!-- Draggable handle -->
			<circle
				cx={point.x}
				cy={point.y}
				r="5"
				fill="white"
				stroke={colors.selectedStroke}
				stroke-width="2"
				style="cursor: move;"
				onmousedown={(e) => {
					e.stopPropagation();
					onDragWaypoint(i, e);
				}}
			/>

			<!-- Remove button -->
			<circle
				cx={point.x + 10}
				cy={point.y - 10}
				r="4"
				fill="#ef4444"
				stroke="white"
				stroke-width="1"
				style="cursor: pointer;"
				onclick={(e) => {
					e.stopPropagation();
					onRemoveWaypoint(i);
				}}
			/>
		</g>
	{/if}
{/each}

<!-- Add waypoint buttons (on edge segments) -->
{#each route.slice(0, -1) as point, i}
	{@const next = route[i + 1]}
	{@const midX = (point.x + next.x) / 2}
	{@const midY = (point.y + next.y) / 2}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<circle
		cx={midX}
		cy={midY}
		r="4"
		fill={colors.entityFill}
		stroke={colors.selectedStroke}
		stroke-width="1.5"
		stroke-dasharray="2 2"
		opacity="0.6"
		style="cursor: pointer;"
		onclick={(e) => {
			e.stopPropagation();
			onAddWaypoint(i + 1);
		}}
	/>
{/each}
