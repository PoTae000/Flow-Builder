<script lang="ts">
	import { collab } from '$lib/stores/collab.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { onMount } from 'svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { importJson, importErd } from '$lib/utils/export';
	import type { DiagramData } from '$lib/types/session';
	import type { NotationStyle } from '$lib/types/notation';
	import type {
		ImportedDiagramData,
		ImportedFlowchartData,
		ImportedDFDData
	} from '$lib/utils/import-adapter';

	type AnyImported = ImportedDiagramData | ImportedFlowchartData | ImportedDFDData;
	const isFlow = (d: AnyImported): d is ImportedFlowchartData => 'flowNodes' in d;
	const isDfd = (d: AnyImported): d is ImportedDFDData => 'dfdNodes' in d;
	import ImportSqlTab from './ImportSqlTab.svelte';
	import ImportDumpTab from './ImportDumpTab.svelte';
	import ImportImageTab from './ImportImageTab.svelte';
	import ImportTextTab from './ImportTextTab.svelte';
	import ImportMermaidTab from './ImportMermaidTab.svelte';

	let { onclose, initialTab }: { onclose: () => void; initialTab?: 'sketch' } = $props();

	type TabId = 'sketch' | 'erd' | 'sql' | 'dump' | 'image' | 'text' | 'json' | 'mermaid';



	const isEr = diagram.diagramType === 'er';

	const allTabs: { id: TabId; label: string; aiRequired: boolean; erOnly: boolean }[] = [
		{ id: 'erd', label: 'ERD', aiRequired: false, erOnly: true },
		{ id: 'sql', label: 'SQL DDL', aiRequired: false, erOnly: true },
		{ id: 'dump', label: 'DB Dump', aiRequired: false, erOnly: true },
		{ id: 'mermaid', label: 'Mermaid', aiRequired: false, erOnly: false },
		{ id: 'sketch', label: 'วาดด้วยมือ', aiRequired: true, erOnly: false },
		{ id: 'image', label: 'รูปภาพ (AI)', aiRequired: true, erOnly: false },
		{ id: 'text', label: 'ข้อความ (AI)', aiRequired: true, erOnly: false },
		{ id: 'json', label: 'JSON', aiRequired: false, erOnly: true }
	];
	const tabs = $derived(allTabs.filter((t) => (isEr || !t.erOnly) && (auth.isSignedIn || !t.aiRequired)));

	let activeTab = $state<TabId>((auth.isSignedIn ? initialTab : undefined) ?? (isEr ? 'erd' : 'mermaid'));
	let importMode = $state<'replace' | 'merge'>('replace');
	let aiAvailable = $state(false);


	let previewData: AnyImported | null = $state(null);
	let previewWarnings: string[] = $state([]);
	let previewContext = '';

	onMount(async () => {
		try {
			const res = await fetch('/api/import/check');
			const data: any = await res.json();
			aiAvailable = data.available;
		} catch {
			aiAvailable = false;
		}
	});

	const duplicateNames = $derived.by(() => {
		if (!previewData || importMode !== 'merge') return [];
		if (isFlow(previewData) || isDfd(previewData)) return [];
		const existing = new Set(diagram.entities.map(e => e.name.toLowerCase()));
		return previewData.entities.filter(e => existing.has(e.name.toLowerCase())).map(e => e.name);
	});

	function handlePreview(data: AnyImported, warnings: string[]) {
		previewContext = `${diagram.diagramType}:${diagram.dfdCurrentParentId ?? ''}`;
		previewData = data;
		previewWarnings = warnings;
	}

	async function confirmImport() {
		if (!previewData || diagram.viewOnly || collab.isViewer) return;
		if (previewContext !== `${diagram.diagramType}:${diagram.dfdCurrentParentId ?? ''}`) { previewWarnings = ['ไดอะแกรมเปลี่ยน กรุณานำเข้าใหม่']; return; }
		let applied = false;
		if (isFlow(previewData)) {
			if (diagram.diagramType !== 'flowchart') return;
			applied = await diagram.replaceContent({
				flowNodes: importMode === 'replace' ? previewData.flowNodes : [...diagram.flowNodes, ...previewData.flowNodes],
				flowEdges: importMode === 'replace' ? previewData.flowEdges : [...diagram.flowEdges, ...previewData.flowEdges]
			}, 'Import', !previewData.hasPositions);
		} else if (isDfd(previewData)) {
			if (diagram.diagramType !== 'context') return;
			applied = await diagram.replaceDFDLevel(
				importMode === 'replace' ? previewData.dfdNodes : [...diagram.dfdVisibleNodes, ...previewData.dfdNodes],
				importMode === 'replace' ? previewData.dfdFlows : [...diagram.dfdVisibleFlows, ...previewData.dfdFlows],
				'Import', !previewData.hasPositions
			);
		} else {
			if (diagram.diagramType !== 'er') return;
			const existingNames = new Set(diagram.entities.map(e => e.name.toLowerCase()));
			const renamed = previewData.entities.map(e => {
				let name = e.name, counter = 2;
				if (importMode === 'merge') while (existingNames.has(name.toLowerCase())) name = `${e.name}_${counter++}`;
				existingNames.add(name.toLowerCase());
				return { ...e, name };
			});
			applied = await diagram.replaceContent({
				...(previewData.notation ? { notation: previewData.notation } : {}),
				entities: importMode === 'replace' ? renamed : [...diagram.entities, ...renamed],
				relationships: importMode === 'replace' ? previewData.relationships : [...diagram.relationships, ...previewData.relationships]
			}, 'Import', !previewData.hasPositions);
		}
		if (!applied) return;
		previewData = null;
		previewWarnings = [];
		onclose();
	}

	function cancelPreview() {
		previewData = null;
		previewWarnings = [];
	}

	async function handleErdImport() {
		try {
			const data = await importErd() as DiagramData & { format?: string };
			if (!data.entities || !data.relationships) {
				dialog.alert('ข้อผิดพลาด', 'ไฟล์ .erd ไม่ถูกต้อง');
				return;
			}

			if (diagram.viewOnly || collab.isViewer || !await collab.acquireLocks(diagram.editableItemIds)) return;
			if (!await diagram.replaceContent({ entities: data.entities, relationships: data.relationships }, 'Import file')) return;
			if (data.notation) diagram.notation = data.notation as NotationStyle;
			if (data.diagramFont) diagram.diagramFont = data.diagramFont;
			if (data.diagramFontSize) diagram.diagramFontSize = data.diagramFontSize;
			if (data.panX !== undefined) diagram.panX = data.panX;
			if (data.panY !== undefined) diagram.panY = data.panY;
			if (data.zoom !== undefined) diagram.zoom = data.zoom;
			if (data.bookmarks) {
				diagram.bookmarks.clear();
				for (const { slot, panX, panY, zoom } of data.bookmarks) {
					diagram.bookmarks.set(slot, { panX, panY, zoom });
				}
			}
			onclose();
		} catch {
			// user cancelled
		}
	}

	async function handleJsonImport() {
		try {
			const data = await importJson() as DiagramData;
			if (!data.entities || !data.relationships) {
				dialog.alert('ข้อผิดพลาด', 'ไฟล์ JSON ไม่ถูกต้อง');
				return;
			}

			if (diagram.viewOnly || collab.isViewer || !await collab.acquireLocks(diagram.editableItemIds)) return;
			if (!await diagram.replaceContent({ entities: data.entities, relationships: data.relationships }, 'Import file')) return;
			if (data.notation) diagram.notation = data.notation as NotationStyle;
			if (data.diagramFont) diagram.diagramFont = data.diagramFont;
			if (data.diagramFontSize) diagram.diagramFontSize = data.diagramFontSize;
			if (data.panX !== undefined) diagram.panX = data.panX;
			if (data.panY !== undefined) diagram.panY = data.panY;
			if (data.zoom !== undefined) diagram.zoom = data.zoom;
			if (data.bookmarks) {
				diagram.bookmarks.clear();
				for (const { slot, panX, panY, zoom } of data.bookmarks) {
					diagram.bookmarks.set(slot, { panX, panY, zoom });
				}
			}
			onclose();
		} catch {
			// user cancelled
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>


<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/50 animate-fade-in"
	onclick={onclose}
	onkeydown={handleKeydown}
></div>


<div class="fixed left-1/2 top-1/2 z-50 w-[680px] max-w-[calc(100vw-2rem)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl animate-scale-in">

	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<h2 class="text-sm font-normal text-[var(--ui-text)]">นำเข้า Diagram</h2>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<div class="p-5">
		{#if previewData}

			<div class="flex flex-col gap-4">
				<div class="flex items-center gap-2">
					<svg class="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					<span class="text-sm text-[var(--ui-text)]">ตัวอย่างข้อมูล</span>
				</div>

				<div class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-xs">
					{#if isFlow(previewData)}
						<div class="mb-2 font-medium text-[var(--ui-text)]">
							{previewData.flowNodes.length} โหนด, {previewData.flowEdges.length} เส้นเชื่อม
						</div>
						<div class="max-h-40 overflow-y-auto space-y-1">
							{#each previewData.flowNodes as node}
								<div class="text-[var(--ui-text-secondary)]">
									<span class="font-medium text-[var(--ui-text)]">{node.name}</span>
									<span class="text-[var(--ui-text-muted)]"> ({node.type})</span>
								</div>
							{/each}
						</div>
					{:else if isDfd(previewData)}
						<div class="mb-2 font-medium text-[var(--ui-text)]">
							{previewData.dfdNodes.length} โหนด, {previewData.dfdFlows.length} การไหลข้อมูล
						</div>
						<div class="max-h-40 overflow-y-auto space-y-1">
							{#each previewData.dfdNodes as node}
								<div class="text-[var(--ui-text-secondary)]">
									<span class="font-medium text-[var(--ui-text)]">{node.name}</span>
									<span class="text-[var(--ui-text-muted)]"> ({node.type})</span>
								</div>
							{/each}
						</div>
					{:else}
						<div class="mb-2 font-medium text-[var(--ui-text)]">
							{previewData.entities.length} เอนทิตี, {previewData.relationships.length} ความสัมพันธ์
						</div>
						<div class="max-h-40 overflow-y-auto space-y-1">
							{#each previewData.entities as entity}
								<div class="text-[var(--ui-text-secondary)]">
									<span class="font-medium text-[var(--ui-text)]">{entity.name}</span>
									{#if entity.attributes.length > 0}
										<span class="text-[var(--ui-text-muted)]">
											({entity.attributes.map(a => a.name).join(', ')})
										</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				{#if previewWarnings.length > 0}
					<div class="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
						{#each previewWarnings as warning}
							<div>{warning}</div>
						{/each}
					</div>
				{/if}

				{#if duplicateNames.length > 0}
					<div class="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
						ชื่อซ้ำกับ entity ที่มีอยู่ (จะเติม _2, _3, ... อัตโนมัติ): {duplicateNames.join(', ')}
					</div>
				{/if}


				<div class="flex items-center gap-3">
					<span class="text-xs text-[var(--ui-text-muted)]">โหมด:</span>
					<label class="flex items-center gap-1.5 text-xs text-[var(--ui-text-secondary)]">
						<input type="radio" bind:group={importMode} value="replace" class="accent-[var(--ui-accent)]" />
						แทนที่
					</label>
					<label class="flex items-center gap-1.5 text-xs text-[var(--ui-text-secondary)]">
						<input type="radio" bind:group={importMode} value="merge" class="accent-[var(--ui-accent)]" />
						รวม
					</label>
				</div>

				<div class="flex justify-end gap-2">
					<button
						onclick={cancelPreview}
						class="rounded border border-[var(--ui-border)] px-4 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
					>
						ย้อนกลับ
					</button>
					<button
						onclick={confirmImport}
						class="rounded bg-[var(--ui-accent)] px-4 py-1.5 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90"
					>
						ยืนยันนำเข้า
					</button>
				</div>
			</div>
		{:else}

			<div class="mb-4 flex flex-col gap-3">
				{#each [{ paid: false, label: 'ใช้ฟรี' }, { paid: true, label: 'AI · ต้องสมัครโปร (Advanced)' }].filter(group => auth.isSignedIn || !group.paid) as group}
				<div class="flex flex-col gap-1.5">
					<span class="text-[11px] text-[var(--ui-text-muted)]">{group.label}</span>
					<div class="flex flex-wrap gap-1 rounded-lg bg-[var(--ui-bg-secondary)] p-1">
				{#each tabs.filter(tab => tab.aiRequired === group.paid) as tab}
					<button
						onclick={() => { if (tab.aiRequired && (!auth.isSignedIn || (!auth.isAdmin && auth.plan !== 'advanced'))) { ui.showUpgradeModal = true; return; } activeTab = tab.id; }}
						class="flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs transition {activeTab === tab.id
							? 'bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-sm'
							: 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'}"
					>
						{tab.label}
						{#if tab.aiRequired}<span class="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-300">PRO</span>{/if}
					</button>
				{/each}
					</div>
				</div>
				{/each}
			</div>


			{#if activeTab === 'erd'}
				<div class="flex flex-col gap-3">
					<p class="text-xs text-[var(--ui-text-muted)]">
						เปิดไฟล์ .erd ที่ export ไว้ — กู้คืน diagram ทั้งหมด
					</p>
					<button
						onclick={handleErdImport}
						class="flex items-center justify-center gap-1.5 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
						เลือกไฟล์ .erd
					</button>
				</div>
			{:else if activeTab === 'sql'}
				<ImportSqlTab onpreview={handlePreview} />
			{:else if activeTab === 'dump'}
				<ImportDumpTab onpreview={handlePreview} />
			{:else if activeTab === 'mermaid'}
				<ImportMermaidTab onpreview={handlePreview} {onclose} />
			{:else if activeTab === 'sketch'}
				<ImportImageTab {aiAvailable} sketch onpreview={handlePreview} />
			{:else if activeTab === 'image'}
				<ImportImageTab {aiAvailable} onpreview={handlePreview} />
			{:else if activeTab === 'text'}
				<ImportTextTab {aiAvailable} onpreview={handlePreview} />
			{:else if activeTab === 'json'}
				<div class="flex flex-col gap-3">
					<p class="text-xs text-[var(--ui-text-muted)]">
						นำเข้าไฟล์ JSON ที่ export ไว้ก่อนหน้า
					</p>
					<button
						onclick={handleJsonImport}
						class="flex items-center justify-center gap-1.5 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
						เลือกไฟล์ JSON
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
