<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import type { ERShape } from '$lib/utils/er-palette';
	import { placeERShape } from '$lib/utils/er-palette';
	import { getRenderer } from '$lib/renderers';
	const renderer = $derived(getRenderer(diagram.notation));
	let suppressClick = false;
	let drag: {
		type: ERShape;
		x: number;
		y: number;
		startX: number;
		startY: number;
		pointerId: number;
	} | null = $state(null);
	function startDrag(e: PointerEvent, type: ERShape) {
		if (e.button !== 0 || collab.isViewer || diagram.viewOnly) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = {
			type,
			x: e.clientX,
			y: e.clientY,
			startX: e.clientX,
			startY: e.clientY,
			pointerId: e.pointerId
		};
	}
	function moveDrag(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.pointerId) return;
		drag = { ...drag, x: e.clientX, y: e.clientY };
	}
	function finishDrag(e: PointerEvent) {
		const item = drag;
		drag = null;
		if (!item || Math.hypot(e.clientX - item.startX, e.clientY - item.startY) < 6) return;
		suppressClick = true;
		setTimeout(() => (suppressClick = false), 500);
		const canvas = document.querySelector<SVGSVGElement>('[data-diagram-canvas]');
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const target = document.elementFromPoint(e.clientX, e.clientY);
		if (
			!target ||
			!canvas.contains(target) ||
			e.clientX < rect.left ||
			e.clientX > rect.right ||
			e.clientY < rect.top ||
			e.clientY > rect.bottom
		)
			return;
		placeERShape(item.type, {
			x: (e.clientX - rect.left - diagram.panX) / diagram.zoom,
			y: (e.clientY - rect.top - diagram.panY) / diagram.zoom
		});
	}
</script>

{#snippet shapeIcon(type: string)}
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.3"
		aria-hidden="true"
	>
		<rect x="3" y="4" width="18" height="16" rx="1" />
		{#if renderer.inlineAttributes}<path d="M 3 9 H 21" />{/if}
		{#if type === 'weak-entity'}<rect x="6" y="7" width="12" height="10" />{/if}
	</svg>
{/snippet}
<div data-onboarding="entity-palette">
 <button
  type="button"
  class="flex w-full cursor-grab touch-none items-center gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-3 text-left text-[var(--ui-text)] transition hover:border-[var(--ui-text-muted)] active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
  disabled={collab.isViewer || diagram.viewOnly}
  aria-label="เพิ่ม Entity"
  onpointerdown={(e) => startDrag(e, 'entity')}
  onpointermove={moveDrag}
  onpointerup={finishDrag}
  onpointercancel={() => drag = null}
  onclick={() => { if (!drag && !suppressClick) placeERShape('entity'); }}
 >
  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] text-[var(--ui-text-secondary)]">{@render shapeIcon('entity')}</span>
  <span class="min-w-0 flex-1"><span class="block text-sm font-medium">เพิ่ม Entity</span><span class="mt-0.5 block text-[10px] text-[var(--ui-text-muted)]">คลิกเพื่อเพิ่ม หรือลากลงพื้นที่วาด</span></span>
  <svg aria-hidden="true" class="h-4 w-4 shrink-0 text-[var(--ui-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" d="M12 5v14M5 12h14" /></svg>
 </button>
</div>
{#if drag && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 6}
	<div
		class="pointer-events-none fixed z-[100] rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2 text-[var(--ui-text)]"
		style:left="{drag.x}px"
		style:top="{drag.y}px"
	>
		{@render shapeIcon(drag.type)}
	</div>
{/if}
