<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { aiFetch } from '$lib/utils/ai-fetch';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	type ERLangId = 'sql-mysql' | 'sql-postgres' | 'sql-sqlite' | 'prisma' | 'typeorm' | 'django' | 'laravel' | 'sequelize';
	type FlowLangId = 'pseudocode' | 'python' | 'javascript' | 'java' | 'csharp';
	type DFDLangId = 'data-dictionary' | 'process-specs';
	type LangId = ERLangId | FlowLangId | DFDLangId;

	const erLanguages: { id: ERLangId; label: string; icon: string }[] = [
		{ id: 'sql-mysql', label: 'MySQL', icon: '🐬' },
		{ id: 'sql-postgres', label: 'PostgreSQL', icon: '🐘' },
		{ id: 'sql-sqlite', label: 'SQLite', icon: '📦' },
		{ id: 'prisma', label: 'Prisma', icon: '△' },
		{ id: 'typeorm', label: 'TypeORM', icon: 'TS' },
		{ id: 'django', label: 'Django', icon: '🐍' },
		{ id: 'laravel', label: 'Laravel', icon: '🔺' },
		{ id: 'sequelize', label: 'Sequelize', icon: 'JS' }
	];

	const flowLanguages: { id: FlowLangId; label: string; icon: string }[] = [
		{ id: 'pseudocode', label: 'Pseudocode', icon: '📝' },
		{ id: 'python', label: 'Python', icon: '🐍' },
		{ id: 'javascript', label: 'JavaScript', icon: 'JS' },
		{ id: 'java', label: 'Java', icon: '☕' },
		{ id: 'csharp', label: 'C#', icon: 'C#' }
	];

	const dfdLanguages: { id: DFDLangId; label: string; icon: string }[] = [
		{ id: 'data-dictionary', label: 'Data Dictionary', icon: '📋' },
		{ id: 'process-specs', label: 'Process Specs', icon: '📄' }
	];

	const languages = $derived(() => {
		if (diagram.diagramType === 'flowchart') return flowLanguages;
		if (diagram.diagramType === 'context') return dfdLanguages;
		return erLanguages;
	});

	let selectedLang = $state<LangId>('sql-mysql');

	// Reset selected language when diagram type changes
	$effect(() => {
		const langs = languages();
		if (!langs.find(l => l.id === selectedLang)) {
			selectedLang = langs[0].id;
		}
	});

	const hasData = $derived(() => {
		if (diagram.diagramType === 'flowchart') return diagram.flowNodes.length > 0;
		if (diagram.diagramType === 'context') return diagram.dfdNodes.length > 0;
		return diagram.entities.length > 0;
	});

	let loading = $state(false);
	let generatedCode = $state('');
	let errorMsg = $state('');
	let copied = $state(false);

	async function generate() {
		loading = true;
		errorMsg = '';
		generatedCode = '';

		try {
			let body: any = {
				language: selectedLang,
				diagramType: diagram.diagramType
			};

			if (diagram.diagramType === 'flowchart') {
				body.flowNodes = $state.snapshot(diagram.flowNodes);
				body.flowEdges = $state.snapshot(diagram.flowEdges);
			} else if (diagram.diagramType === 'context') {
				body.dfdNodes = $state.snapshot(diagram.dfdNodes);
				body.dfdFlows = $state.snapshot(diagram.dfdFlows);
			} else {
				body.entities = $state.snapshot(diagram.entities);
				body.relationships = $state.snapshot(diagram.relationships);
			}

			const res = await aiFetch('/api/generate-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const errData: any = await res.json().catch(() => ({ message: 'เกิดข้อผิดพลาด' }));
				errorMsg = errData.message || `Error ${res.status}`;
				return;
			}

			const data: any = await res.json();
			generatedCode = data.code;
		} catch {
			errorMsg = 'เชื่อมต่อไม่ได้ ลองใหม่';
		} finally {
			loading = false;
		}
	}

	async function copyCode() {
		await navigator.clipboard.writeText(generatedCode);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}

	function downloadCode() {
		const lang = languages().find((l) => l.id === selectedLang);
		const ext = lang?.id.startsWith('sql') ? 'sql' : lang?.id === 'prisma' ? 'prisma' : lang?.id === 'django' ? 'py' : lang?.id === 'laravel' ? 'php' : lang?.id === 'typeorm' ? 'ts' : 'js';
		const blob = new Blob([generatedCode], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `er-diagram.${ext}`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 bg-black/50 animate-fade-in" onclick={onclose} onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}></div>

<!-- Modal -->
<div class="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[680px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl animate-scale-in">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<h2 class="text-sm font-normal text-[var(--ui-text)]">Generate Code</h2>
		<button onclick={onclose} class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)]" aria-label="ปิด">
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<div class="flex min-h-0 flex-1 flex-col p-5">
		<!-- Language selector -->
		<div class="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
			{#each languages() as lang}
				<button
					onclick={() => { selectedLang = lang.id; generatedCode = ''; }}
					class="rounded-lg border px-2 py-2 text-center text-xs transition {selectedLang === lang.id
						? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)]'
						: 'border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:border-[var(--ui-text-muted)]'}"
				>
					<span class="text-sm">{lang.icon}</span>
					<span class="ml-1">{lang.label}</span>
				</button>
			{/each}
		</div>

		<!-- Generate button -->
		{#if !generatedCode}
			<button
				onclick={generate}
				disabled={loading || !hasData()}
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ui-accent)] px-4 py-2.5 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-50"
			>
				{#if loading}
					<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
					กำลังสร้างโค้ด...
				{:else}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
					สร้างโค้ด {languages().find((l) => l.id === selectedLang)?.label}
				{/if}
			</button>
		{/if}

		<!-- Skeleton code block while loading -->
		{#if loading}
			<div class="mt-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-4">
				<div class="flex flex-col gap-2">
					<div class="skeleton h-3 w-3/4"></div>
					<div class="skeleton h-3 w-full"></div>
					<div class="skeleton h-3 w-5/6"></div>
					<div class="skeleton h-3 w-2/3"></div>
					<div class="skeleton h-3 w-full"></div>
					<div class="skeleton h-3 w-4/5"></div>
					<div class="skeleton h-3 w-1/2"></div>
					<div class="skeleton h-3 w-full"></div>
					<div class="skeleton h-3 w-3/5"></div>
					<div class="skeleton h-3 w-2/5"></div>
				</div>
			</div>
		{/if}

		<!-- Error -->
		{#if errorMsg}
			<div class="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
				{errorMsg}
			</div>
		{/if}

		<!-- Generated code -->
		{#if generatedCode}
			<div class="flex items-center gap-2 mb-2">
				<button
					onclick={copyCode}
					class="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				>
					{#if copied}
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
						คัดลอกแล้ว
					{:else}
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
						คัดลอก
					{/if}
				</button>
				<button
					onclick={downloadCode}
					class="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
					ดาวน์โหลด
				</button>
				<button
					onclick={() => { generatedCode = ''; }}
					class="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
					สร้างใหม่
				</button>
			</div>
			<div class="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)]">
				<pre class="p-4 text-xs leading-relaxed text-[var(--ui-text)]"><code>{generatedCode}</code></pre>
			</div>
		{/if}
	</div>
</div>
