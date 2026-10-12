<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { aiFetch } from '$lib/utils/ai-fetch';
	import { mermaidToFlow } from '$lib/utils/mermaid';
	import { toast } from '$lib/stores/toast.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let code = $state('');
	let language = $state('auto');
	let generating = $state(false);
	let errorMsg = $state('');

	const LANGS = [
		{ value: 'auto', label: 'ตรวจอัตโนมัติ' },
		{ value: 'JavaScript', label: 'JavaScript' },
		{ value: 'TypeScript', label: 'TypeScript' },
		{ value: 'Python', label: 'Python' },
		{ value: 'Java', label: 'Java' },
		{ value: 'C', label: 'C / C++' },
		{ value: 'C#', label: 'C#' },
		{ value: 'Go', label: 'Go' },
		{ value: 'PHP', label: 'PHP' },
		{ value: 'SQL', label: 'SQL' }
	];

	const placeholder = `วางโค้ดที่นี่ เช่น

function login(user, pass) {
  if (!user || !pass) return 'missing';
  const ok = check(user, pass);
  if (ok) {
    grantAccess(user);
    return 'ok';
  }
  return 'denied';
}`;

	async function generate() {
		const src = code.trim();
		if (!src) {
			errorMsg = 'กรุณาวางโค้ด';
			return;
		}
		generating = true;
		errorMsg = '';

		try {
			const res = await aiFetch('/api/code-to-flow', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: src, language: language === 'auto' ? '' : language })
			});

			if (!res.ok) {
				const errData: any = await res.json().catch(() => ({ message: 'แปลงไม่สำเร็จ' }));
				throw new Error(errData.message || `Error: ${res.status}`);
			}

			const data: any = await res.json();
			const mermaid: string = (data.mermaid || '').trim();
			if (!mermaid) throw new Error('AI ไม่ตอบกลับ');

			const flow = mermaidToFlow(mermaid);
			if (!flow.flowNodes.length) {
				throw new Error('แปลงเป็น flowchart ไม่ได้ — ลองใหม่หรือปรับโค้ด');
			}

			
			if (diagram.diagramType !== 'flowchart') {
				diagram.diagramType = 'flowchart';
			} else if (diagram.flowNodes.length > 0) {
				const ok = await dialog.confirm({
					title: 'แทนที่ Flowchart',
					message: 'Flowchart ปัจจุบันจะถูกแทนที่ ต้องการดำเนินการต่อหรือไม่?',
					confirmText: 'แทนที่',
					cancelText: 'ยกเลิก',
					variant: 'info'
				});
				if (!ok) { generating = false; return; }
			}

			diagram.loadFlowchartData(flow.flowNodes, flow.flowEdges, 'replace');
			toast.success(`สร้าง Flowchart จากโค้ดแล้ว (${flow.flowNodes.length} โหนด)`);
			onclose();
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
		} finally {
			generating = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && code.trim()) generate();
	}
</script>


<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/50 animate-fade-in"
	onclick={onclose}
	onkeydown={handleKeydown}
></div>


<div class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl animate-scale-in max-sm:landscape:max-h-[calc(100vh-1rem)]">
	
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<h2 class="flex items-center gap-1.5 text-sm font-normal text-[var(--ui-text)]">
			<svg class="h-4 w-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
			โค้ด → Flowchart
		</h2>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	
	<div class="flex flex-col gap-3 p-5">
		<p class="text-xs text-[var(--ui-text-muted)]">
			AI จะอ่าน control flow (if/else, loop, return) แล้ววาดเป็น flowchart ให้อัตโนมัติ
		</p>

		<div class="flex items-center gap-2">
			<span class="text-[11px] text-[var(--ui-text-secondary)]">ภาษา</span>
			<select
				bind:value={language}
				class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1 text-[11px] text-[var(--ui-text)] focus:outline-none"
			>
				{#each LANGS as l}
					<option value={l.value}>{l.label}</option>
				{/each}
			</select>
		</div>

		<textarea
			bind:value={code}
			{placeholder}
			spellcheck="false"
			onkeydown={handleKeydown}
			class="h-56 w-full resize-none rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-muted)] focus:outline-none"
		></textarea>

		{#if errorMsg}
			<p class="text-xs text-red-500">{errorMsg}</p>
		{/if}

		<button
			onclick={generate}
			disabled={!code.trim() || generating}
			class="flex items-center justify-center gap-1.5 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-40"
		>
			{#if generating}
				<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
				กำลังแปลง...
			{:else}
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
				แปลงเป็น Flowchart
			{/if}
		</button>
		<p class="text-center text-[10px] text-[var(--ui-text-muted)]">Ctrl+Enter เพื่อแปลง</p>
	</div>
</div>
