<script lang="ts">
	import { tick } from 'svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	let { x, y, width, height, fontSize, onadd, onclose }: { x:number; y:number; width:number; height:number; fontSize:number; onadd:(name:string)=>boolean; onclose:()=>void } = $props();
	let text = $state('');
	let input: HTMLInputElement;
	function focus(node: HTMLInputElement) { node.focus(); }
	async function next() {
		if (!text.trim()) { onclose(); return; }
		if (!onadd(text)) return;
		text = '';
		await tick(); input?.focus();
	}
	function finish() { if (text.trim()) onadd(text); text = ''; onclose(); }
</script>
<foreignObject {x} {y} {width} {height}>
	<input use:focus bind:this={input} bind:value={text} aria-label="เพิ่ม Attribute" maxlength="100"
		onmousedown={e=>e.stopPropagation()} ontouchstart={e=>e.stopPropagation()} onclick={e=>e.stopPropagation()} ondblclick={e=>e.stopPropagation()}
		onblur={finish} onkeydown={e=>{ e.stopPropagation(); if(e.isComposing)return; if(e.key==='Enter'){e.preventDefault();void next();} if(e.key==='Escape'){e.preventDefault();text='';onclose();} }}
		style={`width:100%;height:100%;box-sizing:border-box;background:${theme.colors.entityFill};color:${theme.colors.entityText};font-family:${diagram.diagramFont};font-size:${fontSize}px;border:0;outline:0;padding:0;margin:0;min-width:0;min-height:0;border-radius:0;`} />
</foreignObject>
