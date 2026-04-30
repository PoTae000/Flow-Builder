<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { i18n } from '$lib/i18n';
	import type { CardinalityType } from '$lib/types/er';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	let sortBy = $state<'name' | 'relationships'>('name');
	let sortAsc = $state(true);

	// Inline create form
	let showRelForm = $state(false);
	let presetEntity1 = $state('');
	let presetEntity2 = $state('');
	let newRelName = $state('');
	let newRelCard1 = $state<CardinalityType>('1');
	let newRelCard2 = $state<CardinalityType>('N');

	const entityRelCount = $derived(
		new Map(diagram.entities.map(e => [
			e.id,
			diagram.relationships.filter(r => r.entityIds[0] === e.id || r.entityIds[1] === e.id).length
		]))
	);

	const sortedEntities = $derived.by(() => {
		const list = [...diagram.entities];
		if (sortBy === 'name') {
			list.sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
		} else {
			list.sort((a, b) => {
				const ca = entityRelCount.get(a.id) ?? 0;
				const cb = entityRelCount.get(b.id) ?? 0;
				return sortAsc ? ca - cb : cb - ca;
			});
		}
		return list;
	});

	const relationshipMatrix = $derived.by(() => {
		const map = new Map<string, typeof diagram.relationships>();
		for (const rel of diagram.relationships) {
			const key1 = `${rel.entityIds[0]}:${rel.entityIds[1]}`;
			const key2 = `${rel.entityIds[1]}:${rel.entityIds[0]}`;
			if (!map.has(key1)) map.set(key1, []);
			if (!map.has(key2)) map.set(key2, []);
			map.get(key1)!.push(rel);
			map.get(key2)!.push(rel);
		}
		return map;
	});

	const totalPossible = $derived(
		diagram.entities.length * (diagram.entities.length - 1) / 2
	);
	const uniquePairs = $derived.by(() => {
		const seen = new Set<string>();
		for (const rel of diagram.relationships) {
			const key = [rel.entityIds[0], rel.entityIds[1]].sort().join(':');
			seen.add(key);
		}
		return seen.size;
	});
	const density = $derived(
		totalPossible > 0 ? Math.round((uniquePairs / totalPossible) * 100) : 0
	);

	function getCellRels(rowId: string, colId: string) {
		return relationshipMatrix.get(`${rowId}:${colId}`) ?? [];
	}

	function handleCellClick(rowId: string, colId: string) {
		const rels = getCellRels(rowId, colId);
		if (rels.length > 0) {
			diagram.selectRelationship(rels[0].id);
		} else if (rowId !== colId) {
			presetEntity1 = rowId;
			presetEntity2 = colId;
			newRelName = '';
			newRelCard1 = '1';
			newRelCard2 = 'N';
			showRelForm = true;
		}
	}

	function createRelationship() {
		if (!newRelName.trim() || !presetEntity1 || !presetEntity2) return;
		diagram.addRelationship(
			newRelName.trim(),
			[presetEntity1, presetEntity2],
			[newRelCard1, newRelCard2]
		);
		showRelForm = false;
	}

	function getEntityName(id: string) {
		return diagram.entityMap.get(id)?.name ?? '?';
	}

	const cardOptions: CardinalityType[] = ['1', 'N', 'M', '0..1', '0..N', '1..N'];
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/30 animate-fade-in"
	onclick={onclose}
	onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
></div>

<!-- Slide-over panel -->
<div class="fixed right-0 top-0 z-50 flex h-full w-full md:w-[640px] md:max-w-[90vw] flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl panel-slide-in">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">{i18n.t('matrix.title')}</h2>
		</div>
		<div class="flex items-center gap-2">
			<!-- Sort buttons -->
			<button
				class="rounded px-2 py-1 text-[10px] transition {sortBy === 'name' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)]'}"
				onclick={() => { if (sortBy === 'name') sortAsc = !sortAsc; else { sortBy = 'name'; sortAsc = true; } }}
			>
				{i18n.t('matrix.sortByName')} {sortBy === 'name' ? (sortAsc ? '↑' : '↓') : ''}
			</button>
			<button
				class="rounded px-2 py-1 text-[10px] transition {sortBy === 'relationships' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)]'}"
				onclick={() => { if (sortBy === 'relationships') sortAsc = !sortAsc; else { sortBy = 'relationships'; sortAsc = false; } }}
			>
				{i18n.t('matrix.sortByRels')} {sortBy === 'relationships' ? (sortAsc ? '↑' : '↓') : ''}
			</button>

			<button
				onclick={onclose}
				class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
				aria-label="Close"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-auto p-4">
		{#if diagram.entities.length < 2}
			<div class="flex flex-col items-center gap-3 py-16">
				<svg class="h-8 w-8 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" /></svg>
				<span class="text-xs text-[var(--ui-text-muted)]">{i18n.t('matrix.empty')}</span>
			</div>
		{:else}
			<!-- Matrix table -->
			<div class="overflow-auto rounded-lg border border-[var(--ui-border)]">
				<table class="border-collapse text-xs">
					<thead>
						<tr>
							<th class="sticky left-0 top-0 z-20 bg-[var(--ui-bg-secondary)] border-b border-r border-[var(--ui-border)] px-3 py-2 h-28"></th>
							{#each sortedEntities as col}
								<th class="sticky top-0 z-10 bg-[var(--ui-bg-secondary)] border-b border-[var(--ui-border)] px-1 py-2 h-28 font-medium text-[var(--ui-text-secondary)] align-bottom">
									<div class="relative h-full">
										<span class="absolute bottom-0 left-1/2 origin-bottom-left -rotate-45 whitespace-nowrap text-xs" title={col.name}>
											{col.name}
										</span>
									</div>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each sortedEntities as row}
							<tr>
								<td class="sticky left-0 z-10 bg-[var(--ui-bg)] border-b border-r border-[var(--ui-border)] px-3 py-1.5 font-medium text-[var(--ui-text)] whitespace-nowrap">
									{row.name}
								</td>
								{#each sortedEntities as col}
									{@const rels = getCellRels(row.id, col.id)}
									{@const isSelf = row.id === col.id}
									<td class="border-b border-[var(--ui-border)] px-1 py-1 text-center {isSelf ? 'bg-[var(--ui-bg-secondary)]' : ''}">
										{#if isSelf}
											<span class="text-[var(--ui-text-muted)] opacity-30">--</span>
										{:else if rels.length > 0}
											<button
												class="w-full rounded px-1 py-0.5 text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition truncate max-w-[100px]"
												title="{rels.map(r => `${r.name} [${r.cardinalities[0]}:${r.cardinalities[1]}]`).join(', ')}"
												onclick={() => handleCellClick(row.id, col.id)}
											>
												{rels[0].name} <span class="opacity-60">{rels[0].cardinalities[0]}:{rels[0].cardinalities[1]}</span>
												{#if rels.length > 1}<span class="opacity-50"> +{rels.length - 1}</span>{/if}
											</button>
										{:else}
											<button
												class="w-full rounded px-1 py-0.5 text-[var(--ui-text-muted)] opacity-0 hover:opacity-60 transition cursor-pointer"
												onclick={() => handleCellClick(row.id, col.id)}
												title="{i18n.t('matrix.createRel')}: {row.name} ↔ {col.name}"
											>
												+
											</button>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<!-- Inline create relationship form -->
		{#if showRelForm}
			<div class="mt-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4">
				<div class="mb-3 text-xs font-medium text-[var(--ui-text)]">
					{i18n.t('matrix.createRel')}: {getEntityName(presetEntity1)} ↔ {getEntityName(presetEntity2)}
				</div>
				<div class="flex flex-col gap-2">
					<input
						type="text"
						bind:value={newRelName}
						placeholder={i18n.t('matrix.relName')}
						class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-xs text-[var(--ui-text)] outline-none focus:border-blue-400"
						onkeydown={(e) => { if (e.key === 'Enter') createRelationship(); if (e.key === 'Escape') showRelForm = false; }}
					/>
					<div class="flex items-center gap-2">
						<select bind:value={newRelCard1} class="flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1 text-xs text-[var(--ui-text)]">
							{#each cardOptions as c}<option value={c}>{c}</option>{/each}
						</select>
						<span class="text-xs text-[var(--ui-text-muted)]">:</span>
						<select bind:value={newRelCard2} class="flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1 text-xs text-[var(--ui-text)]">
							{#each cardOptions as c}<option value={c}>{c}</option>{/each}
						</select>
					</div>
					<div class="flex gap-2">
						<button
							onclick={createRelationship}
							disabled={!newRelName.trim()}
							class="flex-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white transition hover:bg-blue-700 disabled:opacity-50"
						>
							{i18n.t('matrix.createRel')}
						</button>
						<button
							onclick={() => showRelForm = false}
							class="rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
						>
							{i18n.t('common.cancel')}
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Footer -->
	{#if diagram.entities.length >= 2}
		<div class="flex items-center justify-between border-t border-[var(--ui-border)] px-5 py-3 text-[10px] text-[var(--ui-text-muted)]">
			<span>{diagram.entities.length} entities · {diagram.relationships.length} relationships</span>
			<span>{i18n.t('matrix.density')}: {density}%</span>
		</div>
	{/if}
</div>
