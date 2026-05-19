<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { session } from '$lib/stores/session.svelte';

	let { onclose }: { onclose: () => void } = $props();

	const entries = $derived(diagram.historyEntries);
	let previewIndex = $state(-1); // -1 = no preview active

	function handlePreview(index: number) {
		previewIndex = index;
		diagram.previewHistoryEntry(index);
	}

	function handleApply() {
		diagram.exitPreview(true);
		previewIndex = -1;
		session.saveNow();
		onclose();
	}

	function handleCancel() {
		diagram.exitPreview(false);
		previewIndex = -1;
	}

	function handleClose() {
		if (diagram.timelinePreviewActive) {
			diagram.exitPreview(false);
		}
		previewIndex = -1;
		onclose();
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 animate-fade-in" onclick={handleClose} onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }}></div>

<!-- Panel -->
<div class="fixed z-50 max-h-[80vh] overflow-y-auto border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-xl animate-scale-in inset-x-0 bottom-0 w-full rounded-t-2xl md:inset-x-auto md:bottom-auto md:top-26 md:right-3 md:w-72 md:rounded-lg">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			<span class="text-sm font-medium text-[var(--ui-text)]">{diagram.timelinePreviewActive ? 'Previewing...' : 'History'}</span>
		</div>
		<button
			class="rounded p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			onclick={handleClose}
			aria-label="Close"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<div class="p-4">
		{#if entries.length === 0}
			<div class="py-8 text-center text-xs text-[var(--ui-text-muted)]">
				No history yet
			</div>
		{:else}
			<!-- Apply/Cancel bar when previewing -->
			{#if diagram.timelinePreviewActive}
				<div class="mb-3 flex items-center gap-2">
					<button
						class="flex-1 rounded bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition"
						onclick={handleApply}
					>
						Apply
					</button>
					<button
						class="flex-1 rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs font-medium text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition"
						onclick={handleCancel}
					>
						Cancel
					</button>
				</div>
			{/if}

			<!-- Current state indicator -->
			<button
				class="mb-3 flex w-full items-center gap-2 rounded px-3 py-2 transition {previewIndex === -1 ? 'bg-green-500/10 ring-1 ring-green-500/30' : 'bg-[var(--ui-bg-secondary)] hover:bg-[var(--ui-hover)]'}"
				onclick={handleCancel}
				disabled={!diagram.timelinePreviewActive}
			>
				<span class="h-2 w-2 rounded-full bg-green-500"></span>
				<span class="text-xs font-medium text-[var(--ui-text)]">Current</span>
			</button>

			<!-- History entries (most recent first) -->
			<div class="space-y-1">
				{#each entries.toReversed() as entry, reversedIdx}
					{@const originalIndex = entries.length - 1 - reversedIdx}
					<button
						class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs transition {previewIndex === originalIndex ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'hover:bg-[var(--ui-hover)]'}"
						onclick={() => handlePreview(originalIndex)}
					>
						<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--ui-bg-secondary)] text-[10px] font-mono text-[var(--ui-text-muted)]">
							{originalIndex + 1}
						</span>
						<span class="flex-1 truncate text-[var(--ui-text-secondary)]">{entry}</span>
						<svg class="h-3 w-3 shrink-0 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" /></svg>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
