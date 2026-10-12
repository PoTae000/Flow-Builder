<script lang="ts">
 import CommentsPanel from '$lib/components/ui/CommentsPanel.svelte';
 import DiagramCanvas from '$lib/components/diagram/DiagramCanvas.svelte';
 import Toolbar from '$lib/components/ui/Toolbar.svelte';
 const noop = () => {};
 let open = $state(true);
</script>
<svelte:head><title>Preview — แผงด้านข้าง</title></svelte:head>
<div class="flex h-screen flex-col bg-[var(--ui-bg)] text-[var(--ui-text)]">
 <header class="flex h-11 shrink-0 items-center gap-4 border-b border-[var(--ui-border)] px-4 text-xs">
  <strong>Flow Builder · Layout preview</strong>
  <button onclick={() => open = !open} class="rounded border border-[var(--ui-border)] px-3 py-1">{open ? 'ปิดความคิดเห็น' : 'เปิดความคิดเห็น'}</button>
  <a href="/">กลับแอป</a>
 </header>
 <main class="canvas-workspace relative min-h-0 min-w-0 flex-1" style={`--dock-width: ${open ? 400 : 0}px; --dock-open: ${open ? 1 : 0}`}>
  <div class="absolute right-3 top-3 z-[60] max-w-[calc(100%-1.5rem)]"><Toolbar onexport={noop} onimport={noop} onanalyze={noop} ontranslate={noop} ongenerate={noop} onchat={noop} oncollab={noop} oncomments={() => open = true} /></div>
  <DiagramCanvas />
 </main>
</div>
{#if open}<CommentsPanel onclose={() => open = false} />{/if}
