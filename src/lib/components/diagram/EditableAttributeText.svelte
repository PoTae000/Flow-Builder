<script lang="ts">
 import type { Snippet } from 'svelte';
 import type { Attribute } from '$lib/types/er';
 import { diagram } from '$lib/stores/diagram.svelte';
 import { collab } from '$lib/stores/collab.svelte';
 import { theme } from '$lib/stores/theme.svelte';
 import { sanitizeName } from '$lib/utils/sanitize';
 let { entityId, attribute, x, y, width, height = 24, fontSize = 12, onedit, children }: { entityId: string; attribute: Attribute; x: number; y: number; width: number; height?: number; fontSize?: number; onedit?: () => void; children: Snippet } = $props();
 let editing = $state(false); let text = $state('');
 async function edit(e: MouseEvent) {
  e.stopPropagation(); e.preventDefault();
  if (diagram.viewOnly || collab.isViewer) return;
  if (!await collab.acquireLocks([entityId])) return;
  onedit?.();
  diagram.selectEntity(entityId); text = attribute.name; editing = true;
 }
 function save() {
  if (!editing) return;
  editing = false;
  const name = sanitizeName(text);
  if (name && name !== attribute.name) diagram.updateAttribute(entityId, attribute.id, { name });
 }
 function focus(node: HTMLInputElement) { node.focus(); node.setSelectionRange(node.value.length, node.value.length); }
</script>
<svelte:window onpointerdowncapture={(e) => {
 if (editing && (e.target as HTMLElement)?.getAttribute('data-editor-attribute') !== attribute.id) save();
}} />
<!-- svelte-ignore a11y_no_static_element_interactions -->
<g data-attribute-text ondblclick={edit}>
 {#if !editing}{@render children()}{/if}
 {#if editing}
  <foreignObject {x} {y} width={Math.max(50, width)} {height}>
   <input data-editor-attribute={attribute.id} use:focus bind:value={text} aria-label={`แก้ชื่อ Attribute ${attribute.name}`} maxlength="100" onblur={save} onmousedown={(e) => e.stopPropagation()} ondblclick={(e) => e.stopPropagation()} onkeydown={(e) => { e.stopPropagation(); if (e.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { e.preventDefault(); editing = false; } }} style={`width:100%;height:100%;box-sizing:border-box;border:0;border-radius:0;background:${theme.colors.entityFill};color:${theme.colors.entityText};font-family:${diagram.diagramFont};font-size:${fontSize}px;padding:0;margin:0;min-height:0;min-width:0;line-height:normal;outline:none;`} />
  </foreignObject>
 {/if}
</g>
