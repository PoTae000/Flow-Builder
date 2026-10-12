<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { DIAGRAM_TYPE_OPTIONS } from '$lib/types/diagram';
	import type { DiagramType } from '$lib/types/diagram';
</script>

<div class="flex flex-col gap-1.5">
	<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">ประเภท Diagram</span>
	<select
		class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm font-light text-[var(--ui-text)] shadow-sm transition hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
		value={diagram.diagramType}
		onchange={(e) => {
			const val = (e.target as HTMLSelectElement).value as DiagramType;
			diagram.diagramType = val;
		}}
	>
		{#each DIAGRAM_TYPE_OPTIONS as opt}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</div>
