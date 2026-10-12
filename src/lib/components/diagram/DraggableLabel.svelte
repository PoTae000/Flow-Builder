<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Position } from '$lib/types/geometry';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	let { offset = { x: 0, y: 0 }, anchor, route = [], onchange, onclick, children }: { offset?: Position; anchor?: Position; route?: Position[]; onchange: (value: Position) => void; onclick?: (event: PointerEvent) => void; children: Snippet } = $props();
	let drag: { x: number; y: number; original: Position; pointer: number } | null = null;
	let preview = $state<Position | null>(null);
	function start(e: PointerEvent) {
		if (e.button !== 0 || diagram.viewOnly || collab.isViewer || (e.target as Element).closest('input')) return;
		e.stopPropagation();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, original: { ...offset }, pointer: e.pointerId };
	}
	function move(e: PointerEvent) {
		if (!drag || drag.pointer !== e.pointerId) return;
		if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3 && !preview) return;
		const offset = { x: drag.original.x + (e.clientX - drag.x) / diagram.zoom, y: drag.original.y + (e.clientY - drag.y) / diagram.zoom };
        if (anchor && !e.altKey) {
            const point = { x: anchor.x + offset.x, y: anchor.y + offset.y };
            let distance = 10 / diagram.zoom;
            for (let i = 1; i < route.length; i++) {
                const a = route[i - 1], b = route[i];
                const dx = b.x - a.x, dy = b.y - a.y;
                const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
                const x = a.x + t * dx, y = a.y + t * dy;
                const delta = Math.hypot(point.x - x, point.y - y);
                if (delta <= distance) { distance = delta; offset.x = x - anchor.x; offset.y = y - anchor.y; }
            }
        }
        preview = offset;
	}
	function end(event: PointerEvent) { if (preview) onchange(preview); else if (drag) onclick?.(event); drag = null; preview = null; }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<g transform={`translate(${(preview ?? offset).x},${(preview ?? offset).y})`} style="cursor:move;touch-action:none" onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={() => { drag = null; preview = null; }} onmousedown={(e) => e.stopPropagation()}>
	{@render children()}
</g>
