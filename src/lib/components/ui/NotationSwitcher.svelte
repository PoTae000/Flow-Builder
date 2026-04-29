<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { NOTATION_OPTIONS } from '$lib/types/notation';
	import type { NotationStyle } from '$lib/types/notation';
</script>

<div data-onboarding="notation" class="flex flex-col gap-1.5">
	<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">รูปแบบ Notation</span>
	<select
		class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm font-light text-[var(--ui-text)] shadow-sm transition hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
		value={diagram.notation}
		onchange={async (e) => {
			const select = e.target as HTMLSelectElement;
			const val = select.value as NotationStyle;
			if (val === diagram.notation) return;
			const prev = diagram.notation;
			if (await collab.requestPermission('change-notation')) {
				diagram.setNotation(val);
			} else {
				select.value = prev; // revert
			}
		}}
	>
		{#each NOTATION_OPTIONS as opt}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</div>
