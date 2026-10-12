<script lang="ts">
	import { dockPanel } from '$lib/utils/dock-transition';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { i18n } from '$lib/i18n';
	import { storableAttributes } from '$lib/utils/er-to-sqlite';
	import type { SampleCell } from '$lib/types/er';

	let { onclose }: { onclose: () => void } = $props();

	
	let selectedId = $state<string>('');

	const entities = $derived(diagram.entities);
	const selected = $derived(entities.find((e) => e.id === selectedId) ?? null);
	const columns = $derived(selected ? storableAttributes(selected) : []);
	const rows = $derived(selected?.sampleRows ?? []);

	
	$effect(() => {
		if (entities.length === 0) {
			selectedId = '';
			return;
		}
		if (!selectedId || !entities.find((e) => e.id === selectedId)) {
			selectedId = entities[0].id;
		}
	});

	let genCount = $state(5);
	const readOnly = $derived(collab.isViewer);

	function selectEntity(id: string) {
		selectedId = id;
	}

	function addRow() {
		if (!selectedId || readOnly) return;
		diagram.addSampleRow(selectedId);
	}

	function removeRow(index: number) {
		if (!selectedId || readOnly) return;
		diagram.removeSampleRow(selectedId, index);
	}

	function clearAll() {
		if (!selectedId || readOnly) return;
		diagram.clearSampleRows(selectedId);
	}

	function generate() {
		if (!selectedId || readOnly) return;
		const n = Math.max(1, Math.min(100, Math.floor(genCount) || 5));
		diagram.generateSampleData(selectedId, n);
	}

	function onCellInput(rowIndex: number, column: string, value: string) {
		if (!selectedId || readOnly) return;
		
		let cell: SampleCell = value;
		if (value !== '' && !Number.isNaN(Number(value)) && /^-?\d+(\.\d+)?$/.test(value.trim())) {
			cell = Number(value);
		}
		diagram.updateSampleCell(selectedId, rowIndex, column, cell);
	}

	function cellDisplay(value: SampleCell | undefined): string {
		if (value === undefined || value === null) return '';
		return String(value);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function rowCountLabel(n: number): string {
		return i18n.t('sampleData.rowCount').replace('{n}', String(n));
	}
</script>

<svelte:window onkeydown={handleKeydown} />


<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="animate-fade-in fixed inset-0 z-40 bg-black/30" data-panel-backdrop onclick={onclose}></div>


<div
	class="panel-slide-in fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl md:w-[640px] md:max-w-[95vw]" data-workspace-panel transition:dockPanel|global
>
	
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg
				class="h-4 w-4 text-[var(--ui-accent)]"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 6h16M4 10h16M4 14h16M4 18h16"
				/></svg
			>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">{i18n.t('sampleData.title')}</h2>
		</div>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/></svg
			>
		</button>
	</div>

	
	<div class="flex-1 overflow-y-auto p-5">
		{#if entities.length === 0}
			<div
				class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-6 text-center"
			>
				<div class="text-xs text-[var(--ui-text-muted)]">{i18n.t('sampleData.empty')}</div>
			</div>
		{:else}
			
			<div class="mb-4 flex flex-wrap gap-1.5">
				{#each entities as ent (ent.id)}
					<button
						onclick={() => selectEntity(ent.id)}
						class="rounded-full border px-2.5 py-1 text-[11px] transition {ent.id === selectedId
							? 'border-[var(--ui-accent)] bg-[var(--ui-accent)] text-[var(--ui-accent-text)]'
							: 'border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] text-[var(--ui-text-secondary)] hover:border-[var(--ui-accent)] hover:text-[var(--ui-text)]'}"
					>
						{ent.name}
						{#if ent.sampleRows && ent.sampleRows.length > 0}
							<span class="ml-1 opacity-70">{ent.sampleRows.length}</span>
						{/if}
					</button>
				{/each}
			</div>

			{#if selected}
				{#if columns.length === 0}
					<div
						class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400"
					>
						{i18n.t('sampleData.noColumns')}
					</div>
				{:else}
					
					<div class="mb-3 flex flex-wrap items-center gap-2">
						<span class="text-[11px] text-[var(--ui-text-muted)]">{rowCountLabel(rows.length)}</span
						>
						<div class="ml-auto flex items-center gap-2">
							<label class="flex items-center gap-1 text-[11px] text-[var(--ui-text-secondary)]">
								<input
									type="number"
									min="1"
									max="100"
									bind:value={genCount}
									class="w-14 rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-1.5 py-1 text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
								/>
								{i18n.t('sampleData.generateHint')}
							</label>
							<button
								onclick={generate}
								disabled={readOnly}
								class="rounded bg-[var(--ui-accent)] px-2.5 py-1 text-[11px] font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-40"
							>
								{i18n.t('sampleData.generate')}
							</button>
							<button
								onclick={addRow}
								disabled={readOnly}
								class="rounded border border-[var(--ui-border)] px-2.5 py-1 text-[11px] text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] disabled:opacity-40"
							>
								{i18n.t('sampleData.addRow')}
							</button>
							<button
								onclick={clearAll}
								disabled={readOnly || rows.length === 0}
								class="rounded border border-[var(--ui-border)] px-2.5 py-1 text-[11px] text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] disabled:opacity-40"
							>
								{i18n.t('sampleData.clear')}
							</button>
						</div>
					</div>

					
					<div class="overflow-x-auto rounded-lg border border-[var(--ui-border)]">
						<table class="w-full border-collapse text-xs">
							<thead>
								<tr class="bg-[var(--ui-bg-secondary)]">
									{#each columns as col (col.id)}
										<th
											class="border-r border-b border-[var(--ui-border)] px-3 py-1.5 text-left font-medium whitespace-nowrap text-[var(--ui-text)]"
										>
											{col.name}
											{#if col.type === 'primary_key'}
												<span class="ml-1 text-[10px] text-amber-500">PK</span>
											{:else if col.type === 'foreign_key'}
												<span class="ml-1 text-[10px] text-blue-500">FK</span>
											{/if}
										</th>
									{/each}
									<th class="w-8 border-b border-[var(--ui-border)] px-1 py-1.5"></th>
								</tr>
							</thead>
							<tbody>
								{#if rows.length === 0}
									<tr>
										<td
											colspan={columns.length + 1}
											class="px-3 py-6 text-center text-[var(--ui-text-muted)]"
										>
											{i18n.t('sampleData.addRow')} →
										</td>
									</tr>
								{:else}
									{#each rows as row, rowIndex (rowIndex)}
										<tr class="odd:bg-[var(--ui-bg)] even:bg-[var(--ui-bg-secondary)]/40">
											{#each columns as col (col.id)}
												<td class="border-r border-b border-[var(--ui-border)] px-1 py-0.5">
													{#if col.type === 'primary_key'}
														
														<input
															value={cellDisplay(row[col.name])}
															placeholder={i18n.t('sampleData.pkAuto')}
															oninput={(e) =>
																onCellInput(rowIndex, col.name, e.currentTarget.value)}
															disabled={readOnly}
															class="w-full min-w-[5rem] bg-transparent px-2 py-1 text-[var(--ui-text-secondary)] outline-none focus:bg-[var(--ui-hover)] disabled:cursor-not-allowed"
														/>
													{:else}
														<input
															value={cellDisplay(row[col.name])}
															oninput={(e) =>
																onCellInput(rowIndex, col.name, e.currentTarget.value)}
															disabled={readOnly}
															class="w-full min-w-[5rem] bg-transparent px-2 py-1 text-[var(--ui-text-secondary)] outline-none focus:bg-[var(--ui-hover)] disabled:cursor-not-allowed"
														/>
													{/if}
												</td>
											{/each}
											<td class="border-b border-[var(--ui-border)] px-1 py-0.5 text-center">
												<button
													onclick={() => removeRow(rowIndex)}
													disabled={readOnly}
													title={i18n.t('sampleData.removeRow')}
													class="rounded p-0.5 text-[var(--ui-text-muted)] transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30"
												>
													<svg
														class="h-3.5 w-3.5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														><path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M6 18L18 6M6 6l12 12"
														/></svg
													>
												</button>
											</td>
										</tr>
									{/each}
								{/if}
							</tbody>
						</table>
					</div>

					<p class="mt-3 text-[11px] text-[var(--ui-text-muted)]">
						ข้อมูลถูกบันทึกในแผนภาพ — อยู่ต่อไปเมื่อเปิดใหม่ และซิงก์ข้ามอุปกรณ์ / แชร์ลิงก์ได้
					</p>
				{/if}
			{/if}
		{/if}
	</div>
</div>
