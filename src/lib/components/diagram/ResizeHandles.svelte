<script lang="ts">
	import type { FlowNode } from '$lib/types/flowchart';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		node,
		touch = false,
		edgesOnly = false,
		onStartResize,
		onResizeMove,
		onResizeEnd
	}: {
		node: FlowNode;

		touch?: boolean;
		edgesOnly?: boolean;
		onStartResize: (handle: string, e: PointerEvent) => void;
		onResizeMove: (e: PointerEvent) => void;
		onResizeEnd: () => void;
	} = $props();

	const colors = $derived(theme.colors);
	const W = $derived(node.width || 140);
	const H = $derived(node.height || 60);
	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);




	const minDim = $derived(Math.min(W, H));
	const handleR = $derived(Math.max(2, Math.min(5, minDim / 4)));
	const cornersOnly = $derived(minDim < 24);





	const HIT_R = $derived(touch ? 11 : 14);

	const allHandles = $derived([
		{ id: 'nw', x: cx - W / 2, y: cy - H / 2, cursor: 'nw-resize', corner: true },
		{ id: 'n', x: cx, y: cy - H / 2, cursor: 'n-resize', corner: false },
		{ id: 'ne', x: cx + W / 2, y: cy - H / 2, cursor: 'ne-resize', corner: true },
		{ id: 'e', x: cx + W / 2, y: cy, cursor: 'e-resize', corner: false },
		{ id: 'se', x: cx + W / 2, y: cy + H / 2, cursor: 'se-resize', corner: true },
		{ id: 's', x: cx, y: cy + H / 2, cursor: 's-resize', corner: false },
		{ id: 'sw', x: cx - W / 2, y: cy + H / 2, cursor: 'sw-resize', corner: true },
		{ id: 'w', x: cx - W / 2, y: cy, cursor: 'w-resize', corner: false }
	]);



	const handles = $derived(cornersOnly || touch ? allHandles.filter((h) => h.corner) : allHandles);

	function startResize(id: string, e: PointerEvent) {
		if (e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();


		try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
		onStartResize(id, e);
	}

	function endResize(e: PointerEvent) {
		try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
		onResizeEnd();
	}
</script>

{#if edgesOnly}
 {#each [
  { id: 'n', x: cx - W / 2, y: cy - H / 2 - 3 / diagram.zoom, width: W, height: 6 / diagram.zoom, cursor: 'ns-resize' },
  { id: 's', x: cx - W / 2, y: cy + H / 2 - 3 / diagram.zoom, width: W, height: 6 / diagram.zoom, cursor: 'ns-resize' },
  { id: 'w', x: cx - W / 2 - 3 / diagram.zoom, y: cy - H / 2, width: 6 / diagram.zoom, height: H, cursor: 'ew-resize' },
  { id: 'e', x: cx + W / 2 - 3 / diagram.zoom, y: cy - H / 2, width: 6 / diagram.zoom, height: H, cursor: 'ew-resize' }
 ] as edge}
 <!-- svelte-ignore a11y_no_static_element_interactions -->
 <rect x={edge.x} y={edge.y} width={edge.width} height={edge.height} fill="transparent" class="resize-handle" style={`cursor:${edge.cursor};touch-action:none`} onpointerdown={(e) => startResize(edge.id, e)} onpointermove={onResizeMove} onpointerup={endResize} onpointercancel={endResize} />
 {/each}
{/if}
{#each handles as h}
	<!-- svelte-ignore a11y_no_static_element_interactions -->

	<circle
		cx={h.x}
		cy={h.y}
		r={edgesOnly ? 5 / diagram.zoom : HIT_R}
		fill="transparent"
		class="resize-handle"
		style="cursor: {h.cursor}; touch-action: none;"
		onpointerdown={(e) => startResize(h.id, e)}
		onpointermove={(e) => onResizeMove(e)}
		onpointerup={endResize}
		onpointercancel={endResize}
	/>

	{#if !edgesOnly}
	<circle
		cx={h.x}
		cy={h.y}
		r={handleR}
		fill={colors.selectedStroke}
		stroke="white"
		stroke-width={handleR < 4 ? 1 : 1.5}
		class="resize-dot"
		style="pointer-events: none;"
	/>
	{/if}
{/each}

<style>
	.resize-dot {
		transition: r 0.15s ease;
	}
	.resize-handle:hover + .resize-dot {
		r: 7;
	}
</style>
