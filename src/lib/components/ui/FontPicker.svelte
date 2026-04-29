<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';

	const fontOptions = [
		{ value: "'TH Sarabun PSK', 'Sarabun', sans-serif", label: 'TH Sarabun PSK' },
		{ value: "'Sarabun', sans-serif", label: 'Sarabun' },
		{ value: "'Kanit', sans-serif", label: 'Kanit' },
		{ value: "'Noto Sans Thai', sans-serif", label: 'Noto Sans Thai' },
		{ value: "Arial, Helvetica, sans-serif", label: 'Arial' },
		{ value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
		{ value: "'Courier New', Courier, monospace", label: 'Courier New' },
		{ value: "'Tahoma', Geneva, sans-serif", label: 'Tahoma' },
	];
</script>

<div class="flex flex-col gap-1.5">
	<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">ฟอนต์ Diagram</span>
	<select
		class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm font-light text-[var(--ui-text)] shadow-sm transition hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
		value={diagram.diagramFont}
		onchange={async (e) => {
			const select = e.target as HTMLSelectElement;
			const val = select.value;
			if (val === diagram.diagramFont) return;
			const prev = diagram.diagramFont;
			if (await collab.requestPermission('change-font')) {
				diagram.setDiagramFont(val);
			} else {
				select.value = prev; // revert
			}
		}}
	>
		{#each fontOptions as opt}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</div>
