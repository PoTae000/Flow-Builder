<script lang="ts">
	import { theme } from '$lib/stores/theme.svelte';

	let {
		node,
		W = 140,
		H = 60,
		onStartConnection
	}: {
		node: { id: string; position: { x: number; y: number } };
		W?: number;
		H?: number;
		onStartConnection: (nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', clientX: number, clientY: number) => void;
	} = $props();

	const colors = $derived(theme.colors);
	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);

	const handles = $derived([
		{ side: 'top' as const, x: cx, y: cy - H / 2 },
		{ side: 'right' as const, x: cx + W / 2, y: cy },
		{ side: 'bottom' as const, x: cx, y: cy + H / 2 },
		{ side: 'left' as const, x: cx - W / 2, y: cy }
	]);

	function handleMouseDown(side: 'top' | 'right' | 'bottom' | 'left', e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		onStartConnection(node.id, side, e.clientX, e.clientY);
	}
</script>

{#each handles as handle}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<circle
		cx={handle.x}
		cy={handle.y}
		r="4"
		fill={colors.entityFill}
		stroke={colors.selectedStroke}
		stroke-width="1.5"
		class="connection-handle"
		onmousedown={(e) => handleMouseDown(handle.side, e)}
		style="cursor: crosshair; opacity: 0.8; pointer-events: all;"
	/>
{/each}

<style>
	.connection-handle {
		transition: all 0.15s ease;
	}
	.connection-handle:hover {
		r: 6;
		opacity: 1 !important;
	}
</style>
