<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { aiFetch } from '$lib/utils/ai-fetch';
	import { toast } from '$lib/stores/toast.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let loading = $state(false);
	let explanation = $state('');
	let errorMsg = $state('');
	let copied = $state(false);

	function buildBody() {
		if (diagram.diagramType === 'er') {
			return {
				diagramType: 'er',
				entities: $state.snapshot(diagram.entities),
				relationships: $state.snapshot(diagram.relationships)
			};
		} else if (diagram.diagramType === 'flowchart') {
			return {
				diagramType: 'flowchart',
				flowNodes: $state.snapshot(diagram.flowNodes),
				flowEdges: $state.snapshot(diagram.flowEdges)
			};
		}
		return {
			diagramType: 'context',
			dfdNodes: $state.snapshot(diagram.dfdVisibleNodes),
			dfdFlows: $state.snapshot(diagram.dfdVisibleFlows)
		};
	}

	async function explain() {
		loading = true;
		errorMsg = '';
		explanation = '';
		try {
			const res = await aiFetch('/api/explain', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildBody())
			});
			if (!res.ok) {
				const errData: any = await res.json().catch(() => ({ message: 'อธิบายไม่สำเร็จ' }));
				throw new Error(errData.message || `Error: ${res.status}`);
			}
			const data: any = await res.json();
			explanation = data.content || '';
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
		} finally {
			loading = false;
		}
	}

	async function copyText() {
		await navigator.clipboard.writeText(explanation);
		copied = true;
		toast.success('คัดลอกแล้ว');
		setTimeout(() => { copied = false; }, 2000);
	}

	
	function renderMarkdown(md: string): string {
		const esc = (s: string) => s
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		const inline = (s: string) => esc(s)
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/`(.+?)`/g, '<code class="rounded bg-[var(--ui-bg-tertiary)] px-1 text-[0.9em]">$1</code>');

		const lines = md.split('\n');
		const out: string[] = [];
		let inList = false;
		const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

		for (const raw of lines) {
			const line = raw.trimEnd();
			if (/^###\s+/.test(line)) {
				closeList();
				out.push(`<h4 class="mt-3 mb-1 text-sm font-semibold text-[var(--ui-text)]">${inline(line.replace(/^###\s+/, ''))}</h4>`);
			} else if (/^##\s+/.test(line)) {
				closeList();
				out.push(`<h3 class="mt-4 mb-1.5 text-sm font-bold text-[var(--ui-accent)]">${inline(line.replace(/^##\s+/, ''))}</h3>`);
			} else if (/^#\s+/.test(line)) {
				closeList();
				out.push(`<h2 class="mt-4 mb-2 text-base font-bold text-[var(--ui-text)]">${inline(line.replace(/^#\s+/, ''))}</h2>`);
			} else if (/^[-*]\s+/.test(line)) {
				if (!inList) { out.push('<ul class="my-1 ml-4 list-disc space-y-1">'); inList = true; }
				out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
			} else if (line.trim() === '') {
				closeList();
			} else {
				closeList();
				out.push(`<p class="my-1.5 leading-relaxed">${inline(line)}</p>`);
			}
		}
		closeList();
		return out.join('');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	const typeLabel = $derived(
		diagram.diagramType === 'flowchart' ? 'Flowchart' :
		diagram.diagramType === 'context' ? 'Context Diagram' : 'ER Diagram'
	);
</script>

<svelte:window onkeydown={handleKeydown} />


<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 bg-black/50 animate-fade-in" onclick={onclose}></div>


<div class="fixed left-1/2 top-1/2 z-50 flex w-[560px] max-w-[calc(100vw-2rem)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl animate-scale-in">
	
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">AI อธิบาย {typeLabel}</h2>
		</div>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	
	<div class="flex-1 overflow-y-auto p-5">
		{#if !explanation && !loading && !errorMsg}
			<div class="flex flex-col items-center gap-3 py-6 text-center">
				<p class="text-xs text-[var(--ui-text-muted)]">
					ให้ AI อ่าน diagram แล้วอธิบายเป็นภาษาคน — ภาพรวม, องค์ประกอบ, ความสัมพันธ์, และ business rules
				</p>
				<button
					onclick={explain}
					class="flex items-center gap-1.5 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
					อธิบาย diagram นี้
				</button>
			</div>
		{/if}

		{#if loading}
			<div class="flex flex-col items-center gap-3 py-8">
				<svg class="h-6 w-6 animate-spin text-[var(--ui-accent)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
				<span class="text-xs text-[var(--ui-text-muted)]">AI กำลังอ่าน diagram...</span>
			</div>
		{/if}

		{#if errorMsg}
			<div class="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
				{errorMsg}
			</div>
		{/if}

		{#if explanation}
			
			<div class="text-xs text-[var(--ui-text-secondary)]">
				{@html renderMarkdown(explanation)}
			</div>
		{/if}
	</div>

	
	{#if explanation}
		<div class="flex justify-end gap-2 border-t border-[var(--ui-border)] px-5 py-3">
			<button
				onclick={copyText}
				class="rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
			>
				{copied ? 'คัดลอกแล้ว!' : 'คัดลอกข้อความ'}
			</button>
			<button
				onclick={explain}
				disabled={loading}
				class="rounded bg-[var(--ui-accent)] px-3 py-1.5 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-60"
			>
				อธิบายใหม่
			</button>
		</div>
	{/if}
</div>
