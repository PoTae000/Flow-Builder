<script lang="ts">
	import { tick } from 'svelte';

	
	
	
	
	let {
		x,
		y,
		width,
		height,
		fontSize,
		fontWeight = 400,
		fontStyle = 'normal',
		color,
		fontFamily,
		text = $bindable(''),
		onSave,
		onCancel
	}: {
		x: number;
		y: number;
		width: number;
		height: number;
		fontSize: number;
		fontWeight?: number;
		fontStyle?: string;
		color: string;
		fontFamily: string;
		text: string;
		onSave: (text: string) => void;
		onCancel: () => void;
	} = $props();

	let inputEl: HTMLTextAreaElement;

	function autoGrow() {
		if (!inputEl) return;
		inputEl.style.height = 'auto';
		inputEl.style.height = `${inputEl.scrollHeight}px`;
	}

	$effect(() => {
		tick().then(() => {
			inputEl?.focus();
			inputEl?.select();
			autoGrow();
		});
	});

	function handleKeydown(e: KeyboardEvent) {
		
		
		
		e.stopPropagation();
		
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onSave(text);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}
</script>

<foreignObject {x} {y} {width} {height} style="overflow: visible;">
	
	<div
		style="display:flex; align-items:center; justify-content:center; width:{width}px; height:{height}px;"
	>
		<textarea
			bind:this={inputEl}
			bind:value={text}
			rows="1"
			oninput={autoGrow}
			onkeydown={handleKeydown}
			onblur={() => onSave(text)}
			onmousedown={(e) => e.stopPropagation()}
			ondblclick={(e) => e.stopPropagation()}
			style="
				width:100%; box-sizing:border-box; margin:0; padding:1px 4px 3px;
				border:none; outline:none; resize:none; overflow:hidden;
				background:transparent; text-align:center;
				color:{color}; font-size:{fontSize}px; font-weight:{fontWeight};
				font-style:{fontStyle}; font-family:{fontFamily}; line-height:1.35;"
		></textarea>
	</div>
</foreignObject>
