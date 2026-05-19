<script lang="ts">
	import { tick } from 'svelte';

	let {
		text = $bindable(''),
		rect,
		onSave,
		onCancel
	}: {
		text: string;
		rect: DOMRect;
		onSave: (text: string) => void;
		onCancel: () => void;
	} = $props();

	let inputEl: HTMLInputElement;

	$effect(() => {
		tick().then(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			onSave(text);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}
</script>

<input
	bind:this={inputEl}
	bind:value={text}
	onkeydown={handleKeydown}
	onblur={() => onSave(text)}
	class="absolute z-50 border-2 border-blue-500 bg-white px-2 py-1 text-sm shadow-lg dark:bg-gray-800 dark:text-white"
	style="left: {rect.x}px; top: {rect.y}px; width: {rect.width}px;"
/>
