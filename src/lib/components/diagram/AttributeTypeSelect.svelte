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
<foreignObject {x} {y} width="44" {height}>
	<select value={attribute.type} onchange={change} aria-label={`ประเภท Attribute ${attribute.name}`} title="เปลี่ยนประเภท Attribute"
		disabled={diagram.viewOnly || collab.isViewer}
		onmousedown={e => e.stopPropagation()} ontouchstart={e => e.stopPropagation()} onclick={e => e.stopPropagation()} ondblclick={e => e.stopPropagation()} onkeydown={e => e.stopPropagation()}>
		<option value="regular">—</option><option value="primary_key">PK</option><option value="foreign_key">FK</option><option value="partial_key">Partial</option><option value="derived">Derived</option><option value="multivalued">Multi</option>
	</select>
</foreignObject>
<style>
	select { width:100%;height:100%;min-width:0;min-height:0;padding:0 2px;border:1px solid var(--ui-border);border-radius:3px;background:var(--ui-bg-secondary);color:var(--ui-text);font-size:10px;font-family:var(--font-sans);cursor:pointer; }
	select:focus-visible { outline:1px solid var(--ui-text-secondary);outline-offset:1px; }
</style>
