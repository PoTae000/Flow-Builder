<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { NOTATION_OPTIONS } from '$lib/types/notation';
	import type { NotationStyle } from '$lib/types/notation';
	import CustomSelect from './CustomSelect.svelte';

	const selectOptions = NOTATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

	async function handleChange(val: string): Promise<boolean | void> {
		const newVal = val as NotationStyle;
		if (newVal === diagram.notation) return;
		if (await collab.requestPermission('change-notation')) {
			diagram.setNotation(newVal);
		} else {
			return false;
		}
	}
</script>

<div data-onboarding="notation" class="flex flex-col gap-1.5">
	<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">รูปแบบ Notation</span>
	<CustomSelect options={selectOptions} bind:value={diagram.notation} onchange={handleChange} />
</div>
