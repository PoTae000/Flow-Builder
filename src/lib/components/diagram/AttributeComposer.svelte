<script lang="ts">
	import { tick } from 'svelte';
	import type { AttributeType } from '$lib/types/er';
	let { x, y, width, onadd, onclose }: { x: number; y: number; width: number; onadd: (name: string, type: AttributeType) => boolean; onclose: () => void } = $props();
	let name = $state('');
	let type = $state<AttributeType>('regular');
	let input: HTMLInputElement;
	function focus(node: HTMLInputElement) { node.focus(); }
	async function add() {
		if (!onadd(name, type)) return;
		name = ''; type = 'regular';
		await tick(); input?.focus();
	}
</script>
<foreignObject {x} {y} width={Math.max(260, width)} height="86" style="overflow:visible">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="composer" onmousedown={e => e.stopPropagation()} ontouchstart={e => e.stopPropagation()} onclick={e => e.stopPropagation()} ondblclick={e => e.stopPropagation()} onkeydown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); onclose(); } }}>
		<form onsubmit={e => { e.preventDefault(); void add(); }}>
			<input use:focus bind:this={input} bind:value={name} aria-label="ชื่อ Attribute ใหม่" placeholder="ชื่อ Attribute…" maxlength="100" onkeydown={e => { if (e.isComposing && e.key === 'Enter') e.preventDefault(); }} />
			<select bind:value={type} aria-label="ประเภท Attribute ใหม่">
				<option value="regular">Regular</option><option value="primary_key">PK</option><option value="foreign_key">FK</option><option value="partial_key">Partial key</option><option value="derived">Derived</option><option value="multivalued">Multivalued</option>
			</select>
			<button type="submit" disabled={!name.trim()} aria-label="เพิ่ม Attribute">เพิ่ม</button>
		</form>
		<div class="hint"><span>Enter เพิ่มต่อ · Esc ปิด</span><button type="button" onclick={onclose}>เสร็จ</button></div>
	</div>
</foreignObject>
<style>
	.composer { padding:7px;border:1px solid var(--ui-border);border-radius:7px;background:var(--ui-bg);color:var(--ui-text);box-shadow:0 4px 12px #0002;font-family:var(--font-sans); }
	form { display:flex;gap:4px; } input,select,button { font:inherit;font-size:11px;min-height:26px;border-radius:4px; } input,select { border:1px solid var(--ui-border);background:var(--ui-bg-secondary);color:var(--ui-text);padding:3px 5px; } input { min-width:0;flex:1;width:90px; } select { width:82px; } button { padding:3px 7px;background:var(--ui-accent);color:var(--ui-accent-text);cursor:pointer; } button:disabled { opacity:.4; } .hint { display:flex;align-items:center;justify-content:space-between;margin-top:5px;font-size:9px;color:var(--ui-text-muted); } .hint button { background:transparent;color:var(--ui-text-secondary);min-height:18px;font-size:10px;padding:0 4px; }
</style>
