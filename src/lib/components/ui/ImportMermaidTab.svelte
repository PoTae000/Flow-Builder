<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { detectMermaidKind, mermaidToEr, mermaidToFlow } from '$lib/utils/mermaid';
	import type { ImportedDiagramData } from '$lib/utils/import-adapter';

	let {
		onpreview,
		onclose
	}: {
		onpreview: (data: ImportedDiagramData, warnings: string[]) => void;
		onclose: () => void;
	} = $props();

	let text = $state('');
	let errorMsg = $state('');

	const placeholder = `วางโค้ด Mermaid ที่นี่...

erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        int id PK
        string name
    }

หรือ

flowchart TD
    A([Start]) --> B{Check?}
    B -->|Yes| C[Process]
    B -->|No| D([End])`;

	function handleImport() {
		const src = text.trim();
		if (!src) {
			errorMsg = 'กรุณาวางโค้ด Mermaid';
			return;
		}
		errorMsg = '';
		const kind = detectMermaidKind(src);

		if (kind === 'er') {
			const data = mermaidToEr(src);
			if (data.entities.length === 0) {
				errorMsg = 'ไม่พบเอนทิตีในโค้ด — ตรวจสอบรูปแบบ erDiagram';
				return;
			}
			const warnings: string[] = [];
			if (diagram.diagramType !== 'er') {
				warnings.push('โค้ดนี้เป็น ER — สลับไปแท็บ ER Diagram ก่อนนำเข้า');
			}
			onpreview(data, warnings);
		} else if (kind === 'flowchart') {
			if (diagram.diagramType !== 'flowchart') {
				errorMsg = 'โค้ดนี้เป็น Flowchart — สลับไปแท็บ Flowchart ก่อน แล้วนำเข้าอีกครั้ง';
				return;
			}
			const data = mermaidToFlow(src);
			if (data.flowNodes.length === 0) {
				errorMsg = 'ไม่พบโหนดในโค้ด — ตรวจสอบรูปแบบ flowchart';
				return;
			}
			diagram.loadFlowchartData(data.flowNodes, data.flowEdges, 'replace');
			onclose();
		} else {
			errorMsg = 'ไม่รู้จักรูปแบบ — โค้ดต้องขึ้นต้นด้วย erDiagram หรือ flowchart';
		}
	}
</script>

<div class="flex flex-col gap-3">
	<p class="text-xs text-[var(--ui-text-muted)]">
		รองรับ <code class="text-[var(--ui-text-secondary)]">erDiagram</code> และ
		<code class="text-[var(--ui-text-secondary)]">flowchart</code> — คัดลอกจาก GitHub / Notion / Obsidian มาวางได้เลย
	</p>

	<textarea
		bind:value={text}
		{placeholder}
		spellcheck="false"
		class="h-52 w-full resize-none rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-muted)] focus:outline-none"
	></textarea>

	{#if errorMsg}
		<p class="text-xs text-red-500">{errorMsg}</p>
	{/if}

	<button
		onclick={handleImport}
		disabled={!text.trim()}
		class="flex items-center justify-center gap-1.5 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-40"
	>
		<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
		นำเข้า Mermaid
	</button>
</div>
