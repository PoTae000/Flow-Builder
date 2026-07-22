<script lang="ts">
	import { theme } from '$lib/stores/theme.svelte';

	let {
		node,
		W = 140,
		H = 60,
		isSelected = false,
		onStartConnection
	}: {
		node: { id: string; position: { x: number; y: number } };
		W?: number;
		H?: number;
		isSelected?: boolean;
		onStartConnection: (nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', clientX: number, clientY: number) => void;
	} = $props();

	const colors = $derived(theme.colors);
	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);

	// Triangle arrow size + gap from node edge
	const base = 10;
	const depth = 8;
	const gap = 6;

	const handles = $derived([
		{
			side: 'top' as const,
			x: cx,
			y: cy - H / 2 - gap,
			// ▲ pointing up
			points: `${cx},${cy - H / 2 - gap - depth} ${cx - base / 2},${cy - H / 2 - gap} ${cx + base / 2},${cy - H / 2 - gap}`
		},
		{
			side: 'right' as const,
			x: cx + W / 2 + gap,
			y: cy,
			// ▶ pointing right
			points: `${cx + W / 2 + gap + depth},${cy} ${cx + W / 2 + gap},${cy - base / 2} ${cx + W / 2 + gap},${cy + base / 2}`
		},
		{
			side: 'bottom' as const,
			x: cx,
			y: cy + H / 2 + gap,
			// ▼ pointing down
			points: `${cx},${cy + H / 2 + gap + depth} ${cx - base / 2},${cy + H / 2 + gap} ${cx + base / 2},${cy + H / 2 + gap}`
		},
		{
			side: 'left' as const,
			x: cx - W / 2 - gap,
			y: cy,
			// ◀ pointing left
			points: `${cx - W / 2 - gap - depth},${cy} ${cx - W / 2 - gap},${cy - base / 2} ${cx - W / 2 - gap},${cy + base / 2}`
		}
	]);

	function handleMouseDown(side: 'top' | 'right' | 'bottom' | 'left', e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		onStartConnection(node.id, side, e.clientX, e.clientY);
	}
</script>

{#each handles as handle}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<g class="connection-handle-group" style="cursor: crosshair;">
		<!-- Invisible hit area for easier clicking -->
		<circle
			cx={handle.x}
			cy={handle.y}
			r="10"
			fill="transparent"
			style="pointer-events: all;"
			onmousedown={(e) => handleMouseDown(handle.side, e)}
		/>
		<!-- Triangle arrow -->
		<polygon
			points={handle.points}
			fill={isSelected ? colors.selectedStroke : colors.entityStroke}
			stroke="white"
			stroke-width="0.5"
			class="connection-arrow"
			style="pointer-events: none;"
		/>
	</g>
{/each}

<style>
	.connection-arrow {
		transition: transform 0.15s ease, fill 0.15s ease;
		transform-origin: center;
		transform-box: fill-box;
	}
	.connection-handle-group:hover .connection-arrow {
		transform: scale(1.2);
		filter: brightness(1.2);
	}
</style>
