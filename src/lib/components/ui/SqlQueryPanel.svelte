<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { highlight } from '$lib/stores/highlight.svelte';
	import { i18n } from '$lib/i18n';
	import { parseSqlQuery, type ParsedQuery } from '$lib/utils/sql-query-parser';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	let sql = $state('');
	let result = $state<ParsedQuery | null>(null);
	let matchedEntities = $state<{ id: string; name: string }[]>([]);
	let unmatchedTables = $state<string[]>([]);
	let joinPaths = $state<{ from: string; to: string; type: string }[]>([]);
	let columnsByEntity = $state<Map<string, string[]>>(new Map());

	function visualize() {
		if (!sql.trim()) return;

		const parsed = parseSqlQuery(sql);
		result = parsed;

		// Match tables to entities (case-insensitive)
		const entityByName = new Map<string, typeof diagram.entities[0]>();
		for (const e of diagram.entities) {
			entityByName.set(e.name.toLowerCase(), e);
		}

		const matched: typeof matchedEntities = [];
		const unmatched: string[] = [];
		const matchedEntityIds = new Set<string>();
		const tableToEntityId = new Map<string, string>(); // table name → entity id

		for (const table of parsed.tables) {
			const entity = entityByName.get(table.name.toLowerCase());
			if (entity) {
				if (!matchedEntityIds.has(entity.id)) {
					matched.push({ id: entity.id, name: entity.name });
					matchedEntityIds.add(entity.id);
				}
				tableToEntityId.set(table.name.toLowerCase(), entity.id);
			} else {
				if (!unmatched.includes(table.name)) {
					unmatched.push(table.name);
				}
			}
		}

		matchedEntities = matched;
		unmatchedTables = unmatched;

		// Match joins to relationships
		const matchedRelIds = new Set<string>();
		const paths: typeof joinPaths = [];

		for (const join of parsed.joins) {
			const leftId = tableToEntityId.get(join.onLeft.table.toLowerCase());
			const rightId = tableToEntityId.get(join.onRight.table.toLowerCase());
			if (leftId && rightId) {
				// Find relationship between these two entities
				const rel = diagram.relationships.find(r =>
					(r.entityIds[0] === leftId && r.entityIds[1] === rightId) ||
					(r.entityIds[0] === rightId && r.entityIds[1] === leftId)
				);
				if (rel) {
					matchedRelIds.add(rel.id);
				}
				const leftName = diagram.entityMap.get(leftId)?.name ?? join.onLeft.table;
				const rightName = diagram.entityMap.get(rightId)?.name ?? join.onRight.table;
				paths.push({ from: leftName, to: rightName, type: join.type });
			}
		}

		joinPaths = paths;

		// Build columns by entity
		const colMap = new Map<string, string[]>();
		const allColumns = [...parsed.selectedColumns, ...parsed.whereColumns];
		for (const col of allColumns) {
			if (col.table) {
				const entityId = tableToEntityId.get(col.table.toLowerCase());
				if (entityId) {
					if (!colMap.has(entityId)) colMap.set(entityId, []);
					const list = colMap.get(entityId)!;
					if (!list.includes(col.column)) list.push(col.column);
				}
			}
		}
		columnsByEntity = colMap;

		// Set highlights
		highlight.setHighlights(matchedEntityIds, matchedRelIds, colMap);
	}

	function clearHighlights() {
		highlight.clear();
		result = null;
		matchedEntities = [];
		unmatchedTables = [];
		joinPaths = [];
		columnsByEntity = new Map();
	}

	function handleClose() {
		highlight.clear();
		onclose();
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/30 animate-fade-in"
	onclick={handleClose}
	onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }}
></div>

<!-- Slide-over panel -->
<div class="fixed right-0 top-0 z-50 flex h-full w-full md:w-[480px] md:max-w-[90vw] flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl panel-slide-in">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">{i18n.t('sqlQuery.title')}</h2>
		</div>
		<button
			onclick={handleClose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="Close"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-5">
		<!-- SQL Input -->
		<textarea
			bind:value={sql}
			placeholder={i18n.t('sqlQuery.placeholder')}
			class="w-full h-32 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] outline-none focus:border-blue-400 resize-y"
			style="font-family: 'Fira Code', 'Cascadia Code', monospace;"
			onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) visualize(); }}
		></textarea>

		<!-- Buttons -->
		<div class="mt-3 flex gap-2">
			<button
				onclick={visualize}
				disabled={!sql.trim()}
				class="flex-1 rounded bg-blue-600 px-3 py-2 text-xs text-white transition hover:bg-blue-700 disabled:opacity-50"
			>
				{i18n.t('sqlQuery.analyze')}
			</button>
			{#if highlight.active}
				<button
					onclick={clearHighlights}
					class="rounded border border-[var(--ui-border)] px-3 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>
					{i18n.t('sqlQuery.clear')}
				</button>
			{/if}
		</div>

		<!-- Results -->
		{#if result}
			<!-- Errors -->
			{#if result.errors.length > 0}
				<div class="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3">
					{#each result.errors as err}
						<div class="text-xs text-red-600 dark:text-red-400">{err}</div>
					{/each}
				</div>
			{/if}

			<!-- Summary -->
			{#if matchedEntities.length > 0 || unmatchedTables.length > 0}
				<div class="mt-4 text-xs text-[var(--ui-text-muted)]">
					{matchedEntities.length} of {matchedEntities.length + unmatchedTables.length} tables matched
				</div>
			{/if}

			<!-- Matched entities -->
			{#if matchedEntities.length > 0}
				<div class="mt-3">
					<div class="mb-2 text-xs font-medium text-green-600 dark:text-green-400">{i18n.t('sqlQuery.matched')}</div>
					<div class="space-y-1">
						{#each matchedEntities as ent}
							<div class="flex items-center gap-2 rounded border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 px-3 py-1.5">
								<svg class="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
								<span class="text-xs text-[var(--ui-text)]">{ent.name}</span>
								{#if columnsByEntity.get(ent.id)}
									<span class="ml-auto text-[10px] text-[var(--ui-text-muted)]">
										{columnsByEntity.get(ent.id)?.join(', ')}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Unmatched tables -->
			{#if unmatchedTables.length > 0}
				<div class="mt-3">
					<div class="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">{i18n.t('sqlQuery.unmatched')}</div>
					<div class="space-y-1">
						{#each unmatchedTables as table}
							<div class="flex items-center gap-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-1.5">
								<svg class="h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
								<span class="text-xs text-[var(--ui-text-secondary)]">{table}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Join paths -->
			{#if joinPaths.length > 0}
				<div class="mt-3">
					<div class="mb-2 text-xs font-medium text-[var(--ui-text-secondary)]">{i18n.t('sqlQuery.joins')}</div>
					<div class="space-y-1">
						{#each joinPaths as jp}
							<div class="flex items-center gap-2 rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text)]">
								<span>{jp.from}</span>
								<span class="text-[var(--ui-text-muted)]">→</span>
								<span>{jp.to}</span>
								<span class="ml-auto text-[10px] text-[var(--ui-text-muted)]">{jp.type}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- No matches -->
			{#if matchedEntities.length === 0 && result.errors.length === 0}
				<div class="mt-4 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-4 text-center">
					<div class="text-xs text-[var(--ui-text-muted)]">{i18n.t('sqlQuery.noMatch')}</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
