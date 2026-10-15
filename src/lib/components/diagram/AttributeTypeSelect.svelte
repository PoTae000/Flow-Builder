<script lang="ts">
	import type { Attribute, AttributeType } from '$lib/types/er';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	let { entityId, attribute, x, y, height }: { entityId: string; attribute: Attribute; x: number; y: number; height: number } = $props();
	async function change(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const type = select.value as AttributeType;
		select.value = attribute.type;
		if (diagram.viewOnly || collab.isViewer || !await collab.acquireLocks([entityId])) return;
		diagram.updateAttribute(entityId, attribute.id, { type });
	}
</script>
<foreignObject {x} {y} width="44" {height} style="overflow:visible">
	<select value={attribute.type} onchange={change} aria-label={`ประเภท Attribute ${attribute.name}`} title="เปลี่ยนประเภท Attribute"
		disabled={diagram.viewOnly || collab.isViewer}
		onmousedown={e => e.stopPropagation()} ontouchstart={e => e.stopPropagation()} onclick={e => e.stopPropagation()} ondblclick={e => e.stopPropagation()} onkeydown={e => e.stopPropagation()}>
		<option value="regular">—</option><option value="primary_key">PK</option><option value="foreign_key">FK</option><option value="partial_key">Partial</option><option value="derived">Derived</option><option value="multivalued">Multi</option>
	</select>
</foreignObject>
<style>
	select { display:block;box-sizing:border-box;width:100%;height:100%;min-width:0;min-height:0;max-height:100%;margin:0;padding:0 12px 0 3px;border:1px solid var(--ui-border);border-radius:3px;background-color:var(--ui-bg-secondary);color:var(--ui-text);font-size:10px;font-family:var(--font-sans);line-height:1;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 12 12'%3E%3Cpath d='m3 4 3 3 3-3' fill='none' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 3px center; }
	select:focus-visible { outline:1px solid var(--ui-text-secondary);outline-offset:1px; }
</style>
