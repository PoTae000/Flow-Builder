<script lang="ts">
	import { theme } from '$lib/stores/theme.svelte';

	let {
		node,
		W,
		H,
		onStartConnection
	}: {
		node: { id: string; position: { x: number; y: number } };
		W: number;
		H: number;
		onStartConnection: (nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', clientX: number, clientY: number) => void;
	} = $props();

	const colors = $derived(theme.colors);
	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);

	const ZONE = 8; // hit zone thickness

	function handleMouseDown(side: 'top' | 'right' | 'bottom' | 'left', e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		onStartConnection(node.id, side, e.clientX, e.clientY);
	}
</script>

<!-- Top edge zone -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<rect
	x={cx - W / 2}
	y={cy - H / 2 - ZONE / 2}
	width={W}
	height={ZONE}
	fill="transparent"
	class="connection-zone"
	style="cursor: crosshair;"
	onmousedown={(e) => handleMouseDown('top', e)}
/>

<!-- Bottom edge zone -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<rect
	x={cx - W / 2}
	y={cy + H / 2 - ZONE / 2}
	width={W}
	height={ZONE}
	fill="transparent"
	class="connection-zone"
	style="cursor: crosshair;"
	onmousedown={(e) => handleMouseDown('bottom', e)}
/>

<!-- Left edge zone -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<rect
	x={cx - W / 2 - ZONE / 2}
	y={cy - H / 2}
	width={ZONE}
	height={H}
	fill="transparent"
	class="connection-zone"
	style="cursor: crosshair;"
	onmousedown={(e) => handleMouseDown('left', e)}
/>

<!-- Right edge zone -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<rect
	x={cx + W / 2 - ZONE / 2}
	y={cy - H / 2}
	width={ZONE}
	height={H}
	fill="transparent"
	class="connection-zone"
	style="cursor: crosshair;"
	onmousedown={(e) => handleMouseDown('right', e)}
/>

<!-- Visual indicator: highlight border on hover -->
<rect
	x={cx - W / 2}
	y={cy - H / 2}
	width={W}
	height={H}
	rx="3"
	fill="none"
	stroke={colors.selectedStroke}
	stroke-width="2"
	opacity="0.5"
	style="pointer-events: none;"
/>

<style>
	.connection-zone {
		pointer-events: all;
	}
	.connection-zone:hover {
		fill: rgba(59, 130, 246, 0.1);
	}
</style>
