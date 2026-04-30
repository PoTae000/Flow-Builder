<script lang="ts">
	let {
		value,
		onchange
	}: {
		value: string;
		onchange: (value: string) => void;
	} = $props();
</script>

<div class="relative">
	<!-- Search icon -->
	<svg
		class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ui-text-muted)]"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
	>
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
	</svg>

	<input
		type="text"
		{value}
		oninput={(e) => onchange(e.currentTarget.value)}
		placeholder="ค้นหา..."
		class="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] py-1.5 pl-7 pr-7 text-xs text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:ring-1 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
	/>

	<!-- Clear button -->
	{#if value}
		<button
			onclick={() => onchange('')}
			class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--ui-text-muted)] transition hover:text-[var(--ui-text)] hover:scale-110 active:scale-90"
			aria-label="Clear search"
		>
			<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	{/if}
</div>
