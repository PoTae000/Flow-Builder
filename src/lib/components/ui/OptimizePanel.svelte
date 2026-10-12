<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { aiFetch } from '$lib/utils/ai-fetch';
	import { toast } from '$lib/stores/toast.svelte';

	let { onclose }: { onclose: () => void } = $props();

	interface IndexSuggestion {
		table: string;
		columns: string[];
		kind: 'index' | 'composite' | 'unique';
		reason: string;
		sql: string;
	}
	interface NormSuggestion {
		kind: 'normalize' | 'denormalize';
		target: string;
		issue: string;
		suggestion: string;
	}
	interface QueryTip {
		title: string;
		detail: string;
	}
	interface OptimizeResult {
		summary: string;
		indexes: IndexSuggestion[];
		normalization: NormSuggestion[];
		queryTips: QueryTip[];
	}

	let loading = $state(false);
	let result = $state<OptimizeResult | null>(null);
	let errorMsg = $state('');
	let abortController: AbortController | null = null;

	async function optimize(retry = true) {
		loading = true;
		errorMsg = '';
		result = null;
		abortController = new AbortController();
		const timeout = setTimeout(() => abortController?.abort(), 30000);

		try {
			const res = await aiFetch('/api/optimize', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entities: $state.snapshot(diagram.entities),
					relationships: $state.snapshot(diagram.relationships)
				}),
				signal: abortController.signal
			});

			if (res.status === 429 && retry) {
				clearTimeout(timeout);
				await new Promise((r) => setTimeout(r, 5000));
				return optimize(false);
			}
			if (!res.ok) {
				const errData: any = await res.json().catch(() => ({ message: 'วิเคราะห์ไม่สำเร็จ' }));
				throw new Error(errData.message || `Error: ${res.status}`);
			}

			const data: any = await res.json();
			result = {
				summary: data.summary || '',
				indexes: Array.isArray(data.indexes) ? data.indexes : [],
				normalization: Array.isArray(data.normalization) ? data.normalization : [],
				queryTips: Array.isArray(data.queryTips) ? data.queryTips : []
			};
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				errorMsg = 'ใช้เวลานานเกินไป ลองใหม่อีกครั้ง';
			} else {
				errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
			}
		} finally {
			clearTimeout(timeout);
			loading = false;
			abortController = null;
		}
	}

	async function copySql(sql: string) {
		await navigator.clipboard.writeText(sql);
		toast.success('คัดลอก SQL แล้ว');
	}

	async function copyAllSql() {
		if (!result) return;
		const all = result.indexes.map((i) => i.sql).filter(Boolean).join('\n');
		if (!all) return;
		await navigator.clipboard.writeText(all);
		toast.success('คัดลอก SQL ทั้งหมดแล้ว');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	const kindBadge = (kind: string) =>
		kind === 'unique' ? { label: 'UNIQUE', cls: 'bg-purple-500/15 text-purple-500' } :
		kind === 'composite' ? { label: 'COMPOSITE', cls: 'bg-blue-500/15 text-blue-500' } :
		kind === 'denormalize' ? { label: 'DENORMALIZE', cls: 'bg-amber-500/15 text-amber-500' } :
		kind === 'normalize' ? { label: 'NORMALIZE', cls: 'bg-green-500/15 text-green-500' } :
		{ label: 'INDEX', cls: 'bg-cyan-500/15 text-cyan-500' };
</script>

<svelte:window onkeydown={handleKeydown} />


<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 bg-black/50 animate-fade-in" onclick={onclose}></div>


<div class="fixed left-1/2 top-1/2 z-50 flex w-[620px] max-w-[calc(100vw-2rem)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl animate-scale-in">
	
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">AI แนะนำ Index & Optimization</h2>
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
		{#if !result && !loading && !errorMsg}
			<div class="flex flex-col items-center gap-3 py-6 text-center">
				<p class="max-w-sm text-xs text-[var(--ui-text-muted)]">
					ให้ AI ดู schema แล้วแนะนำ index (โดยเฉพาะ FK), normalization/denormalization และเทคนิคเขียน query ให้เร็วขึ้น
				</p>
				<button
					onclick={() => optimize()}
					class="flex items-center gap-1.5 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
					วิเคราะห์ schema นี้
				</button>
			</div>
		{/if}

		{#if loading}
			<div class="flex flex-col items-center gap-3 py-8">
				<svg class="h-6 w-6 animate-spin text-[var(--ui-accent)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
				<span class="text-xs text-[var(--ui-text-muted)]">AI กำลังวิเคราะห์ performance...</span>
			</div>
		{/if}

		{#if errorMsg}
			<div class="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
				{errorMsg}
			</div>
		{/if}

		{#if result}
			{#if result.summary}
				<p class="mb-4 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-xs leading-relaxed text-[var(--ui-text-secondary)]">
					{result.summary}
				</p>
			{/if}

			
			<div class="mb-5">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="flex items-center gap-1.5 text-xs font-semibold text-[var(--ui-text)]">
						<svg class="h-3.5 w-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
						Index ที่แนะนำ ({result.indexes.length})
					</h3>
					{#if result.indexes.length > 0}
						<button
							onclick={copyAllSql}
							class="rounded border border-[var(--ui-border)] px-2 py-1 text-[10px] text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
						>
							คัดลอก SQL ทั้งหมด
						</button>
					{/if}
				</div>
				{#if result.indexes.length === 0}
					<p class="text-xs text-[var(--ui-text-muted)]">ไม่มี index ที่ต้องเพิ่มเพิ่มเติม </p>
				{:else}
					<div class="space-y-2">
						{#each result.indexes as idx}
							{@const badge = kindBadge(idx.kind)}
							<div class="rounded-lg border border-[var(--ui-border)] p-3">
								<div class="mb-1.5 flex items-center gap-2">
									<span class="rounded px-1.5 py-0.5 text-[9px] font-semibold {badge.cls}">{badge.label}</span>
									<span class="font-mono text-xs text-[var(--ui-text)]">{idx.table}</span>
									<span class="text-[10px] text-[var(--ui-text-muted)]">({(idx.columns || []).join(', ')})</span>
								</div>
								<p class="mb-2 text-xs leading-relaxed text-[var(--ui-text-secondary)]">{idx.reason}</p>
								{#if idx.sql}
									<div class="flex items-center gap-2">
										<code class="flex-1 overflow-x-auto whitespace-pre rounded bg-[var(--ui-bg-tertiary)] px-2 py-1.5 font-mono text-[10px] text-[var(--ui-text)]">{idx.sql}</code>
										<button
											onclick={() => copySql(idx.sql)}
											class="shrink-0 rounded border border-[var(--ui-border)] p-1.5 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
											aria-label="คัดลอก SQL"
										>
											<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
										</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			
			{#if result.normalization.length > 0}
				<div class="mb-5">
					<h3 class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--ui-text)]">
						<svg class="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
						Normalization / Denormalization ({result.normalization.length})
					</h3>
					<div class="space-y-2">
						{#each result.normalization as n}
							{@const badge = kindBadge(n.kind)}
							<div class="rounded-lg border border-[var(--ui-border)] p-3">
								<div class="mb-1.5 flex items-center gap-2">
									<span class="rounded px-1.5 py-0.5 text-[9px] font-semibold {badge.cls}">{badge.label}</span>
									<span class="font-mono text-xs text-[var(--ui-text)]">{n.target}</span>
								</div>
								<p class="mb-1 text-xs leading-relaxed text-[var(--ui-text-secondary)]"><span class="text-[var(--ui-text-muted)]">ปัญหา:</span> {n.issue}</p>
								<p class="text-xs leading-relaxed text-[var(--ui-text-secondary)]"><span class="text-[var(--ui-text-muted)]">แนะนำ:</span> {n.suggestion}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			
			{#if result.queryTips.length > 0}
				<div>
					<h3 class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--ui-text)]">
						<svg class="h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
						เทคนิคเขียน Query ({result.queryTips.length})
					</h3>
					<ul class="space-y-2">
						{#each result.queryTips as tip}
							<li class="rounded-lg border border-[var(--ui-border)] p-3">
								<p class="mb-0.5 text-xs font-medium text-[var(--ui-text)]">{tip.title}</p>
								<p class="text-xs leading-relaxed text-[var(--ui-text-secondary)]">{tip.detail}</p>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</div>

	
	{#if result}
		<div class="flex justify-end gap-2 border-t border-[var(--ui-border)] px-5 py-3">
			<button
				onclick={() => optimize()}
				disabled={loading}
				class="rounded bg-[var(--ui-accent)] px-3 py-1.5 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-60"
			>
				วิเคราะห์ใหม่
			</button>
		</div>
	{/if}
</div>
