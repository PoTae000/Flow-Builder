<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import CustomSelect from './CustomSelect.svelte';

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

	async function handleChange(val: string): Promise<boolean | void> {
		if (val === diagram.diagramFont) return;
		if (await collab.requestPermission('change-font')) {
			diagram.setDiagramFont(val);
		} else {
			return false;
		}
	}
</script>

<div class="flex flex-col gap-1.5">
	<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">ฟอนต์ Diagram</span>
	<CustomSelect options={fontOptions} bind:value={diagram.diagramFont} onchange={handleChange} />
</div>
