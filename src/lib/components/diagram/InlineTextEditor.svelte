<script lang="ts">
	import { tick } from 'svelte';

	let {
		text = $bindable(''),
		rect,
		multiline = false,
		fontSize,
		fillBox = false,
		onSave,
		onCancel
	}: {
		text: string;
		rect: DOMRect;
		
		multiline?: boolean;
		
		fontSize?: number;
		
		fillBox?: boolean;
		onSave: (text: string) => void;
		onCancel: () => void;
	} = $props();

	let inputEl: HTMLTextAreaElement;

	
	
	
	function autoGrow() {
		if (!inputEl) return;
		inputEl.style.height = 'auto';
		const min = fillBox ? rect.height : 0;
		inputEl.style.height = `${Math.max(min, inputEl.scrollHeight)}px`;
	}

	$effect(() => {
		tick().then(() => {
			inputEl?.focus();
			inputEl?.select();
			autoGrow();
		});
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			
			
			if (multiline && e.shiftKey) {
				return; 
			}
			e.preventDefault();
			onSave(text);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}
</script>

<textarea
	bind:this={inputEl}
	bind:value={text}
	rows="1"
	oninput={autoGrow}
	onkeydown={handleKeydown}
	onblur={() => onSave(text)}
	class="fixed z-50 resize-none overflow-hidden rounded border-2 border-blue-500 bg-white text-center leading-tight shadow-lg dark:bg-gray-800 dark:text-white {fillBox ? 'px-1 py-0' : 'px-2 py-1 text-sm'}"
	style="left: {rect.x}px; top: {rect.y}px; width: {rect.width}px;{fontSize ? ` font-size: ${fontSize}px;` : ''}{fillBox ? ' display: flex; align-items: center; justify-content: center; text-align: center;' : ''}"
></textarea>
