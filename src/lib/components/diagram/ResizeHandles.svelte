<script lang="ts">
	import type { FlowNode } from '$lib/types/flowchart';

	let {
		node,
		onStartResize
	}: {
		node: FlowNode;
		onStartResize: (handle: string, e: MouseEvent) => void;
	} = $props();

	const W = $derived(node.width || 140);
	const H = $derived(node.height || 60);
	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);

	const handles = $derived([
		{ id: 'nw', x: cx - W / 2, y: cy - H / 2, cursor: 'nw-resize' },
		{ id: 'n', x: cx, y: cy - H / 2, cursor: 'n-resize' },
		{ id: 'ne', x: cx + W / 2, y: cy - H / 2, cursor: 'ne-resize' },
		{ id: 'e', x: cx + W / 2, y: cy, cursor: 'e-resize' },
		{ id: 'se', x: cx + W / 2, y: cy + H / 2, cursor: 'se-resize' },
		{ id: 's', x: cx, y: cy + H / 2, cursor: 's-resize' },
		{ id: 'sw', x: cx - W / 2, y: cy + H / 2, cursor: 'sw-resize' },
		{ id: 'w', x: cx - W / 2, y: cy, cursor: 'w-resize' }
	]);
</script>

{#each handles as h}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<rect
		x={h.x - 4}
		y={h.y - 4}
		width={8}
		height={8}
		fill="white"
		stroke="#3b82f6"
		stroke-width="1.5"
		style="cursor: {h.cursor};"
		onmousedown={(e) => {
			e.stopPropagation();
			onStartResize(h.id, e);
		}}
	/>
{/each}
