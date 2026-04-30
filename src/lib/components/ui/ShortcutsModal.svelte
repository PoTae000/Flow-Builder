<script lang="ts">
	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	const shortcuts: { keys: string[]; desc: string }[] = [
		{ keys: ['Ctrl', 'Z'], desc: 'Undo' },
		{ keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
		{ keys: ['Ctrl', 'Y'], desc: 'Redo' },
		{ keys: ['Ctrl', 'C'], desc: 'Copy Entity' },
		{ keys: ['Ctrl', 'V'], desc: 'Paste Entity' },
		{ keys: ['Ctrl', 'A'], desc: 'Select All' },
		{ keys: ['Ctrl', 'D'], desc: 'Duplicate Selected' },
		{ keys: ['Ctrl', 'F'], desc: 'Find Entity' },
		{ keys: ['Ctrl', 'L'], desc: 'Auto Layout' },
		{ keys: ['Ctrl', 'G'], desc: 'Toggle Grid' },
		{ keys: ['Ctrl', '1-9'], desc: 'Save View Bookmark' },
		{ keys: ['1-9'], desc: 'Jump to Bookmark' },
		{ keys: ['Escape'], desc: 'Deselect All' },
		{ keys: ['Tab'], desc: 'Select Next' },
		{ keys: ['Shift', 'Tab'], desc: 'Select Previous' },
		{ keys: ['Delete'], desc: 'Delete Selected' },
		{ keys: ['?'], desc: 'Show Shortcuts' },
		{ keys: ['Right-click drag'], desc: 'Marquee Select' },
		{ keys: ['Scroll wheel'], desc: 'Zoom' },
		{ keys: ['Left-click drag'], desc: 'Pan (on canvas)' }
	];
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/50 animate-fade-in"
	onclick={onclose}
	onkeydown={() => {}}
></div>

<!-- Modal -->
<div class="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl animate-scale-in">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<h2 class="text-sm font-normal text-[var(--ui-text)]">Keyboard Shortcuts</h2>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="Close"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<!-- Shortcuts grid -->
	<div class="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2">
		{#each shortcuts as shortcut}
			<div class="flex items-center gap-3">
				<div class="flex shrink-0 items-center gap-1">
					{#each shortcut.keys as key}
						<kbd class="inline-flex items-center rounded border border-[var(--ui-border)] bg-[var(--ui-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ui-text)]">
							{key}
						</kbd>
					{/each}
				</div>
				<span class="text-xs text-[var(--ui-text-muted)]">{shortcut.desc}</span>
			</div>
		{/each}
	</div>
</div>
