<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import FontPicker from './FontPicker.svelte';
	let open = $state(false);
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') open = false; }} />
<div class="flex flex-col gap-1.5">
	<span class="text-xs font-normal uppercase tracking-wider text-[var(--ui-text-muted)]">รูปแบบข้อความ</span>
	<button type="button" aria-expanded={open} class="flex w-full items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm font-light text-[var(--ui-text)] shadow-sm transition hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none" onclick={() => open = !open}>
		<span class="flex-1 truncate text-left">ปรับรูปแบบข้อความ</span>
		<svg class="h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)] transition-transform duration-150 {open ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" /></svg>
	</button>
	{#if open}
		<div transition:slide={{ duration: 160, easing: cubicOut }} class="overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)]">
			<div class="flex items-center gap-2 border-b border-[var(--ui-border-light)] px-3 py-2">
				<span class="text-xs font-medium text-[var(--ui-text)]">ปรับรูปแบบข้อความ</span>
				<button type="button" aria-label="ปิดตัวเลือกรูปแบบข้อความ" onclick={() => open = false} class="ml-auto rounded p-0.5 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
			</div>
			<div class="max-h-72 overflow-y-auto p-3"><FontPicker /></div>
		</div>
	{/if}
</div>
