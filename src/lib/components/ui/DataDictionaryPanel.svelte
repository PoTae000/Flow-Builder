<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { generateMarkdownDocs } from '$lib/utils/docs-generator';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	let copied = $state(false);

	// ER-specific stats
	const totalAttrs = $derived(
		diagram.entities.reduce((sum, e) => sum + e.attributes.length, 0)
	);
	const pkCount = $derived(
		diagram.entities.reduce((sum, e) => sum + e.attributes.filter(a => a.type === 'primary_key').length, 0)
	);
	const fkCount = $derived(
		diagram.entities.reduce((sum, e) => sum + e.attributes.filter(a => a.type === 'foreign_key').length, 0)
	);

	// Flowchart-specific stats
	const flowNodesByType = $derived(() => {
		const groups = new Map<string, typeof diagram.flowNodes>();
		for (const node of diagram.flowNodes) {
			if (!groups.has(node.type)) groups.set(node.type, []);
			groups.get(node.type)!.push(node);
		}
		return groups;
	});

	// DFD-specific stats
	const dfdProcesses = $derived(diagram.dfdNodes.filter(n => n.type === 'process'));
	const dfdEntities = $derived(diagram.dfdNodes.filter(n => n.type === 'external-entity'));
	const dfdStores = $derived(diagram.dfdNodes.filter(n => n.type === 'data-store'));

	const entityMap = $derived(
		new Map(diagram.entities.map((e) => [e.id, e]))
	);

	function getRelatedRels(entityId: string) {
		return diagram.relationships.filter(r =>
			r.entityIds[0] === entityId || r.entityIds[1] === entityId
		);
	}

	function getOtherEntityName(rel: typeof diagram.relationships[0], entityId: string) {
		const otherId = rel.entityIds[0] === entityId ? rel.entityIds[1] : rel.entityIds[0];
		return entityMap.get(otherId)?.name ?? '?';
	}

	function formatType(type: string): string {
		switch (type) {
			case 'primary_key': return 'PK';
			case 'foreign_key': return 'FK';
			case 'partial_key': return 'Partial Key';
			case 'derived': return 'Derived';
			case 'multivalued': return 'Multivalued';
			case 'composite': return 'Composite';
			default: return 'Regular';
		}
	}

	function typeColor(type: string): string {
		switch (type) {
			case 'primary_key': return 'text-amber-500';
			case 'foreign_key': return 'text-purple-500';
			case 'derived': return 'text-blue-400';
			case 'multivalued': return 'text-green-400';
			default: return 'text-[var(--ui-text-muted)]';
		}
	}

	async function copyMarkdown() {
		const md = generateMarkdownDocs(
			$state.snapshot(diagram.entities),
			$state.snapshot(diagram.relationships)
		);
		await navigator.clipboard.writeText(md);
		copied = true;
		setTimeout(() => copied = false, 2000);
	}

	function downloadCsv() {
		const lines: string[] = ['Entity,Attribute,Type'];
		for (const entity of diagram.entities) {
			if (entity.attributes.length === 0) {
				lines.push(`"${entity.name}","(none)",""`);
			}
			for (const attr of entity.attributes) {
				lines.push(`"${entity.name}","${attr.name}","${formatType(attr.type)}"`);
			}
		}
		const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'data-dictionary.csv';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/30 animate-fade-in"
	onclick={onclose}
	onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
></div>

<!-- Slide-over panel -->
<div class="fixed right-0 top-0 z-50 flex h-full w-full md:w-[480px] md:max-w-[90vw] flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl panel-slide-in">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">
				{#if diagram.diagramType === 'flowchart'}
					Node List
				{:else if diagram.diagramType === 'context'}
					Flow Dictionary
				{:else}
					Data Dictionary
				{/if}
			</h2>
		</div>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-5">
		{#if diagram.diagramType === 'flowchart'}
			<!-- Flowchart Node List -->
			{#if diagram.flowNodes.length === 0}
				<div class="flex flex-col items-center gap-3 py-16">
					<svg class="h-8 w-8 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
					<span class="text-xs text-[var(--ui-text-muted)]">ยังไม่มี Node เพิ่ม Node ก่อนนะ</span>
				</div>
			{:else}
				<!-- Summary -->
				<div class="mb-5 grid grid-cols-2 gap-2">
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-[var(--ui-text)]">{diagram.flowNodes.length}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">Total Nodes</div>
					</div>
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-[var(--ui-text)]">{diagram.flowEdges.length}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">Connections</div>
					</div>
				</div>

				<!-- Nodes grouped by type -->
				{#each [...flowNodesByType()] as [type, nodes]}
					<div class="mb-4 rounded-lg border border-[var(--ui-border)] overflow-hidden">
						<div class="flex items-center gap-2 bg-[var(--ui-bg-secondary)] px-3 py-2">
							<span class="text-xs font-medium text-[var(--ui-text)]">{type}</span>
							<span class="ml-auto text-[10px] text-[var(--ui-text-muted)]">{nodes.length} node{nodes.length !== 1 ? 's' : ''}</span>
						</div>
						<div class="divide-y divide-[var(--ui-border-light)]">
							{#each nodes as node}
								<div class="px-3 py-1.5 text-xs text-[var(--ui-text-secondary)]">
									{node.name}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{/if}

		{:else if diagram.diagramType === 'context'}
			<!-- DFD Flow Dictionary -->
			{#if diagram.dfdNodes.length === 0}
				<div class="flex flex-col items-center gap-3 py-16">
					<svg class="h-8 w-8 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
					<span class="text-xs text-[var(--ui-text-muted)]">ยังไม่มี Node เพิ่ม Node ก่อนนะ</span>
				</div>
			{:else}
				<!-- Summary -->
				<div class="mb-5 grid grid-cols-2 gap-2">
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-[var(--ui-text)]">{dfdProcesses.length}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">Processes</div>
					</div>
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-[var(--ui-text)]">{diagram.dfdFlows.length}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">Data Flows</div>
					</div>
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-[var(--ui-text)]">{dfdEntities.length}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">External Entities</div>
					</div>
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-[var(--ui-text)]">{dfdStores.length}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">Data Stores</div>
					</div>
				</div>

				<!-- Processes -->
				{#if dfdProcesses.length > 0}
					<div class="mb-4 rounded-lg border border-[var(--ui-border)] overflow-hidden">
						<div class="bg-[var(--ui-bg-secondary)] px-3 py-2">
							<span class="text-xs font-medium text-[var(--ui-text)]">Processes</span>
						</div>
						<div class="divide-y divide-[var(--ui-border-light)]">
							{#each dfdProcesses as node}
								<div class="px-3 py-1.5 text-xs text-[var(--ui-text-secondary)]">
									{#if node.processNumber}
										<span class="text-amber-500 font-medium">{node.processNumber}</span>
										<span class="mx-1">—</span>
									{/if}
									{node.name}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- External Entities -->
				{#if dfdEntities.length > 0}
					<div class="mb-4 rounded-lg border border-[var(--ui-border)] overflow-hidden">
						<div class="bg-[var(--ui-bg-secondary)] px-3 py-2">
							<span class="text-xs font-medium text-[var(--ui-text)]">External Entities</span>
						</div>
						<div class="divide-y divide-[var(--ui-border-light)]">
							{#each dfdEntities as node}
								<div class="px-3 py-1.5 text-xs text-[var(--ui-text-secondary)]">{node.name}</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Data Stores -->
				{#if dfdStores.length > 0}
					<div class="mb-4 rounded-lg border border-[var(--ui-border)] overflow-hidden">
						<div class="bg-[var(--ui-bg-secondary)] px-3 py-2">
							<span class="text-xs font-medium text-[var(--ui-text)]">Data Stores</span>
						</div>
						<div class="divide-y divide-[var(--ui-border-light)]">
							{#each dfdStores as node}
								<div class="px-3 py-1.5 text-xs text-[var(--ui-text-secondary)]">{node.name}</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}

		{:else}
			<!-- ER Data Dictionary -->
			{#if diagram.entities.length === 0}
				<div class="flex flex-col items-center gap-3 py-16">
					<svg class="h-8 w-8 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
					<span class="text-xs text-[var(--ui-text-muted)]">ยังไม่มี Entity เพิ่ม Entity ก่อนนะ</span>
				</div>
			{:else}
				<!-- Summary -->
				<div class="mb-5 grid grid-cols-4 gap-2">
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-[var(--ui-text)]">{diagram.entities.length}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">Entity</div>
					</div>
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-[var(--ui-text)]">{diagram.relationships.length}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">Relationship</div>
					</div>
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-amber-500">{pkCount}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">PK</div>
					</div>
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-center">
						<div class="text-lg font-medium text-purple-500">{fkCount}</div>
						<div class="text-[10px] text-[var(--ui-text-muted)]">FK</div>
					</div>
				</div>

			<!-- Entities -->
			{#each diagram.entities as entity}
				<div class="mb-4 rounded-lg border border-[var(--ui-border)] overflow-hidden">
					<!-- Entity header -->
					<div class="flex items-center gap-2 bg-[var(--ui-bg-secondary)] px-3 py-2">
						{#if entity.color}
							<span class="h-2.5 w-2.5 rounded-full" style="background: {entity.color}"></span>
						{/if}
						<span class="text-xs font-medium text-[var(--ui-text)]">{entity.name}</span>
						{#if entity.isWeak}
							<span class="rounded px-1 py-0.5 text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">Weak</span>
						{/if}
						<span class="ml-auto text-[10px] text-[var(--ui-text-muted)]">{entity.attributes.length} attrs</span>
					</div>

					<!-- Attributes table -->
					{#if entity.attributes.length > 0}
						<div class="divide-y divide-[var(--ui-border-light)]">
							{#each entity.attributes as attr}
								<div class="flex items-center gap-2 px-3 py-1.5">
									<span class="text-xs text-[var(--ui-text-secondary)]">{attr.name}</span>
									<span class="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium {typeColor(attr.type)}">
										{formatType(attr.type)}
									</span>
								</div>
							{/each}
						</div>
					{:else}
						<div class="px-3 py-2 text-xs text-[var(--ui-text-muted)]">ยังไม่มี attribute</div>
					{/if}

					<!-- Related relationships -->
					{#if getRelatedRels(entity.id).length > 0}
						<div class="border-t border-[var(--ui-border)] bg-[var(--ui-bg-tertiary)] px-3 py-1.5">
							<span class="text-[10px] text-[var(--ui-text-muted)]">ความสัมพันธ์:</span>
							{#each getRelatedRels(entity.id) as rel}
								<span class="ml-1 text-[10px] text-[var(--ui-text-secondary)]">
									{rel.name} → {getOtherEntityName(rel, entity.id)} ({rel.cardinalities[0]}:{rel.cardinalities[1]})
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	{/if}
	</div>

	<!-- Footer actions -->
	{#if diagram.entities.length > 0 || diagram.flowNodes.length > 0 || diagram.dfdNodes.length > 0}
		<div class="flex gap-2 border-t border-[var(--ui-border)] px-5 py-3">
			<button
				onclick={copyMarkdown}
				class="flex flex-1 items-center justify-center gap-1.5 rounded border border-[var(--ui-border)] px-3 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
			>
				{#if copied}
					<svg class="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
					คัดลอกแล้ว
				{:else}
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
					Copy Markdown
				{/if}
			</button>
			<button
				onclick={downloadCsv}
				class="flex flex-1 items-center justify-center gap-1.5 rounded border border-[var(--ui-border)] px-3 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
				Download CSV
			</button>
		</div>
	{/if}
</div>
