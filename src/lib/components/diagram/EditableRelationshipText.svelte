<script lang="ts">
 import type { Snippet } from 'svelte';
 import type { Relationship } from '$lib/types/er';
 import { diagram } from '$lib/stores/diagram.svelte';
 import { collab } from '$lib/stores/collab.svelte';
 import { theme } from '$lib/stores/theme.svelte';
 import { sanitizeName } from '$lib/utils/sanitize';
 let { relationship, x, y, width, height = 24, fontSize = 12, onedit, children }: { relationship: Relationship; x: number; y: number; width: number; height?: number; fontSize?: number; onedit?: () => void; children: Snippet } = $props();
 let editing = $state(false); let text = $state('');
 async function edit(e: MouseEvent) {
  e.stopPropagation(); e.preventDefault();
  if (diagram.viewOnly || collab.isViewer) return;
  if (!await collab.acquireLocks([relationship.id])) return;
  onedit?.();
  diagram.selectRelationship(relationship.id); text = relationship.name; editing = true;
 }
 function save() {
  if (!editing) return;
  editing = false;
  const name = sanitizeName(text);
  if (name !== relationship.name) diagram.updateRelationship(relationship.id, { name });
 }
 function focus(node: HTMLInputElement) { node.focus(); node.setSelectionRange(node.value.length, node.value.length); }
</script>
<svelte:window onpointerdowncapture={(e) => {
 if (editing && (e.target as HTMLElement)?.getAttribute('data-editor-relationship') !== relationship.id) save();
}} />
<!-- svelte-ignore a11y_no_static_element_interactions -->
<g data-relationship-text ondblclick={edit}>
 {#if !editing}{@render children()}{/if}
 {#if editing}
  <foreignObject {x} {y} {width} {height}>
   <input data-editor-relationship={relationship.id} use:focus bind:value={text} aria-label={`แก้ชื่อ Relationship ${relationship.name}`} maxlength="100" onblur={save} onmousedown={(e) => e.stopPropagation()} ondblclick={(e) => e.stopPropagation()} onkeydown={(e) => { e.stopPropagation(); if (e.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { e.preventDefault(); editing = false; } }} style={`width:100%;height:100%;box-sizing:border-box;border:0;border-radius:0;background:transparent;color:${theme.colors.relationshipText};box-shadow:none;font-family:${diagram.diagramFont};font-size:${fontSize}px;font-weight:600;text-align:center;padding:0;margin:0;min-height:0;min-width:0;line-height:${height}px;transform:translateY(-${fontSize * 0.18}px);outline:none;`} />
  </foreignObject>
 {/if}
</g>
