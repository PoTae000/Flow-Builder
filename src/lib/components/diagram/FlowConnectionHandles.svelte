<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { getFlowPort } from '$lib/utils/flow-routing';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		node,
		W = 140,
		H = 60,
		isSelected = false,
		onStartConnection
	}: {
		node: { id: string; position: { x: number; y: number }; type?: string };
		W?: number;
		H?: number;
		isSelected?: boolean;
		onStartConnection: (nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', clientX: number, clientY: number) => void;
	} = $props();

	const colors = $derived(theme.colors);
	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);
	const hw = $derived(W / 2);
	const hh = $derived(H / 2);






	const minHalf = $derived(Math.min(hw, hh));


	const compact = $derived(minHalf < 34);




	const sidesOnly = $derived(
		node.type === 'decision' ||
			node.type === 'input-output' ||
			node.type === 'trapezoid' ||
			node.type === 'manual-operation' ||
			node.type === 'preparation' ||
			node.type === 'merge' ||
			node.type === 'extract' ||
			node.type === 'triangle' ||
			node.type === 'or' ||
			node.type === 'summing-junction'
	);

	const points = $derived((['top', 'right', 'bottom', 'left'] as const).map(side => {
  const port = getFlowPort({ ...node, type: node.type || 'process', width: W, height: H }, side);
  const gap = 16 / Math.max(0.75, diagram.zoom);
  return { side, port, x: port.x + (side === 'right' ? gap : side === 'left' ? -gap : 0), y: port.y + (side === 'bottom' ? gap : side === 'top' ? -gap : 0), angle: side === 'right' ? 0 : side === 'bottom' ? 90 : side === 'left' ? 180 : -90 };
 }));
	const hit = $derived(11 / Math.max(0.75, diagram.zoom));

	function handleMouseDown(side: 'top' | 'right' | 'bottom' | 'left', e: MouseEvent) {
		if (e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();
		onStartConnection(node.id, side, e.clientX, e.clientY);
	}

	function handleTouchStart(side: 'top' | 'right' | 'bottom' | 'left', e: TouchEvent) {
		if (e.touches.length !== 1) return;

		e.stopPropagation();
		e.preventDefault();
		const t = e.touches[0];
		onStartConnection(node.id, side, t.clientX, t.clientY);
	}
</script>

{#each points as p}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<g class="conn-point" class:compact style="cursor: crosshair;">

		<rect
			x={Math.min(p.port.x, p.x) - hit}
			y={Math.min(p.port.y, p.y) - hit}
			width={Math.abs(p.x - p.port.x) + hit * 2}
			height={Math.abs(p.y - p.port.y) + hit * 2}
			fill="transparent"
			style="pointer-events: all;"
			onmousedown={(e) => handleMouseDown(p.side, e)}
			ontouchstart={(e) => handleTouchStart(p.side, e)}
		/>

  <g transform={`translate(${p.x},${p.y}) rotate(${p.angle}) scale(${1 / Math.max(0.75, diagram.zoom)})`} style="pointer-events:none">
   <path class="conn-cross" d="M-5 0H5M1-4L5 0 1 4" fill="none" stroke={isSelected ? colors.selectedStroke : '#3b82f6'} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </g>

	</g>
{/each}

<style>
	.conn-cross {
		transition: transform 0.14s ease-out, fill 0.14s ease-out;
		transform-origin: center;
		transform-box: fill-box;
	}
	.conn-point:hover .conn-cross {
		transform: scale(1.25);
		stroke: #60a5fa;
	}
	/* Don't grow the cross on tiny shapes — it would overlap its neighbours. */
	.conn-point.compact:hover .conn-cross {
		transform: scale(1.15);
	}
</style>
