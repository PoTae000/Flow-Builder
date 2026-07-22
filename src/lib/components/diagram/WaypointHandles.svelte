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
		<circle
			cx={point.x}
			cy={point.y}
			r="5"
			fill={colors.selectedStroke}
			stroke="white"
			stroke-width="1.5"
			class="waypoint-handle"
			style="cursor: move;"
			onmousedown={(e) => {
				e.stopPropagation();
				onDragWaypoint(i, e);
			}}
			ondblclick={(e) => {
				e.stopPropagation();
				onRemoveWaypoint(i);
			}}
		/>
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
		fill={colors.selectedStroke}
		stroke="white"
		stroke-width="1"
		opacity="0.35"
		class="add-waypoint-handle"
		style="cursor: pointer;"
		onclick={(e) => {
			e.stopPropagation();
			onAddWaypoint(i + 1);
		}}
	/>
{/each}

<style>
	.waypoint-handle {
		transition: r 0.15s ease;
	}
	.waypoint-handle:hover {
		r: 7;
	}
	.add-waypoint-handle {
		transition: r 0.15s ease, opacity 0.15s ease;
	}
	.add-waypoint-handle:hover {
		r: 6;
		opacity: 0.7 !important;
	}
</style>
