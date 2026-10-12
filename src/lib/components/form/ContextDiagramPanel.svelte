<script lang="ts">
	import { collab } from '$lib/stores/collab.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import type { DFDNodeType } from '$lib/types/context-diagram';
	import AnimatedCounter from '$lib/components/ui/AnimatedCounter.svelte';
	import { DFD_NODE_TYPE_OPTIONS } from '$lib/types/context-diagram';



	const selectedDFDFlow = $derived(
		diagram.selectedEdgeId
			? diagram.dfdFlows.find(f => f.id === diagram.selectedEdgeId) ?? null
			: null
	);

	const MAX_NAME = 100;
	let expandedNodeId = $state<string | null>(null);
	function selectNode(id: string) {
		diagram.selectEntity(id);
		expandedNodeId = expandedNodeId === id ? null : id;
	}
	let paletteDrag = $state<{ type: DFDNodeType; x: number; y: number; startX: number; startY: number; pointer: number } | null>(null);
	function startPalette(event: PointerEvent, type: DFDNodeType) {
		if (event.pointerType === 'mouse' || diagram.viewOnly || collab.isViewer || !canAddType(type)) return;
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		paletteDrag = { type, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, pointer: event.pointerId };
	}
	function canAddType(type: DFDNodeType) {
		return !!diagram.dfdCurrentParentId || (type !== 'data-store' && (type !== 'process' || !diagram.dfdVisibleNodes.some(node => node.type === 'process')));
	}
	function dropPalette(event: PointerEvent) {
		const drag = paletteDrag; paletteDrag = null;
		if (!drag || drag.pointer !== event.pointerId || diagram.viewOnly || collab.isViewer || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
		const svg = document.elementFromPoint(event.clientX, event.clientY)?.closest('svg[data-onboarding="canvas"]');
		if (!svg) return;
		const rect = svg.getBoundingClientRect();
		diagram.addDFDNode('', drag.type, { x: (event.clientX - rect.left - diagram.panX) / diagram.zoom, y: (event.clientY - rect.top - diagram.panY) / diagram.zoom });
	}


</script>

<div class="flex flex-col gap-5">
	<div class="grid grid-cols-3 gap-2">
		{#each DFD_NODE_TYPE_OPTIONS as option}
			<button type="button" draggable={!diagram.viewOnly && !collab.isViewer && canAddType(option.value)} disabled={diagram.viewOnly || collab.isViewer || !canAddType(option.value)} title={canAddType(option.value) ? 'ลากไปวางบนแผนภาพ' : 'Level 0 มี Process เดียว และไม่แสดง Data Store'} class="flex flex-col items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-1 py-3 text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] disabled:opacity-30" style="touch-action:none;cursor:grab"
				ondragstart={(event) => { if (event.dataTransfer) { event.dataTransfer.setData('application/x-dfd-shape', option.value); event.dataTransfer.effectAllowed = 'copy'; } }}
				onpointerdown={(event) => startPalette(event, option.value)}
				onpointermove={(event) => { if (paletteDrag?.pointer === event.pointerId) paletteDrag = { ...paletteDrag, x: event.clientX, y: event.clientY }; }}
				onpointerup={dropPalette} onpointercancel={() => paletteDrag = null}>
				<svg width="36" height="28" viewBox="0 0 36 28" fill="none" stroke="currentColor" stroke-width="1.5">
					{#if option.value === 'process'}<rect x="3" y="2" width="30" height="24" rx="6" /><path d="M3 10h30" />
					{:else if option.value === 'external-entity'}<rect x="3" y="2" width="30" height="24" />
					{:else}<path d="M33 3H3v22h30M10 3v22" />{/if}
				</svg>
				<span class="text-center text-[10px]">{option.label}</span>
			</button>
		{/each}
	</div>
	{#if paletteDrag && Math.hypot(paletteDrag.x - paletteDrag.startX, paletteDrag.y - paletteDrag.startY) > 6}
		<div class="pointer-events-none fixed z-[250] rounded-lg border border-blue-400 bg-[var(--ui-bg)] px-3 py-2 text-xs text-[var(--ui-text)] shadow-lg" style:left="{paletteDrag.x + 12}px" style:top="{paletteDrag.y + 12}px">{DFD_NODE_TYPE_OPTIONS.find(option => option.value === paletteDrag?.type)?.label}</div>
	{/if}


	<div class="flex flex-col gap-2">
		<details class="rounded-lg border border-[var(--ui-border)] p-3 text-xs text-[var(--ui-text-secondary)]">
			<summary class="cursor-pointer">ตรวจโครงสร้าง DFD · {diagram.dfdIssues.length ? `${diagram.dfdIssues.length} จุดที่ต้องแก้` : 'ผ่านกฎโครงสร้าง'}</summary>
			<div class="mt-2 flex max-h-60 flex-col gap-2 overflow-y-auto">
				{#each diagram.dfdIssues as issue}<button class="text-left text-amber-600 dark:text-amber-300" onclick={() => { if (issue.parentId) { const path: string[] = []; let parent: string | undefined = issue.parentId; while (parent && path.length < 3) { path.unshift(parent); parent = diagram.dfdNodes.find(node => node.id === parent)?.parentId; } diagram.dfdDrillPath = path; } else diagram.resetDFDDrill(); if (issue.flowId) diagram.selectRelationship(issue.flowId); else if (issue.nodeId) diagram.selectEntity(issue.nodeId); }}>{issue.message}</button>{/each}
				<p>ตรวจด้วยกฎในโปรแกรม ไม่ใช้ AI หรือ token ตรวจโครงสร้างและข้อมูลเข้า–ออกข้าม Level ส่วนความหมายของข้อมูลต้องตรวจตามระบบที่ออกแบบด้วย</p>
			</div>
		</details>
		<div class="flex items-center justify-between text-xs font-normal uppercase tracking-wider text-[var(--ui-text-muted)]"><span>Nodes</span><span>(<AnimatedCounter value={diagram.dfdVisibleNodes.length} />)</span></div>
		<div class="flex flex-col gap-2">
			{#each diagram.dfdVisibleNodes as node (node.id)}
				{@const isSelected = diagram.selectedNodeIdSet.has(node.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div
					class="min-w-0 cursor-pointer overflow-hidden rounded-lg border p-3 text-sm transition-all duration-150 {isSelected ? 'border-[var(--ui-accent)] bg-[var(--ui-bg-secondary)] shadow-sm' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)]'}"
					onclick={() => selectNode(node.id)}
				>
					<div class="flex items-center justify-between gap-2">
						<button class="flex min-w-0 flex-1 items-center gap-2 text-left text-[var(--ui-text)]" aria-expanded={expandedNodeId === node.id} onclick={(event) => { event.stopPropagation(); selectNode(node.id); }}>
							<svg class="h-3 w-3 shrink-0 text-[var(--ui-text-muted)] transition-transform duration-200 {expandedNodeId === node.id ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
							<span class="truncate">{node.name || 'ไม่มีชื่อ'}</span>
						</button>
					<button
						class="shrink-0 rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
						onclick={(e) => { e.stopPropagation(); diagram.removeDFDNode(node.id); }}
						aria-label="Remove node"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
					</button>
					</div>
					{#if expandedNodeId === node.id}
						<div class="mt-3 flex flex-col gap-2 border-t border-[var(--ui-border-light)] pt-3 text-xs text-[var(--ui-text-muted)]">
							<span>{DFD_NODE_TYPE_OPTIONS.find(option => option.value === node.type)?.label}{node.boundarySourceId ? ' · อ้างอิงจากระดับบน' : ''}</span>
							<fieldset disabled={!!node.boundarySourceId || diagram.viewOnly || collab.isViewer || (collab.connected && !collab.canEdit(node.id))} class="flex flex-col gap-2" onclick={(event) => event.stopPropagation()}>
								<label class="flex flex-col gap-1">ชื่อ Node<input value={node.name} maxlength={MAX_NAME} oninput={(event) => diagram.updateDFDNode(node.id, { name: event.currentTarget.value })} class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-sm text-[var(--ui-text)]" /></label>
								{#if node.type === 'process'}<label class="flex flex-col gap-1">หมายเลข Process<input value={node.processNumber ?? ''} maxlength="10" placeholder="1.0" oninput={(event) => diagram.updateDFDNode(node.id, { processNumber: event.currentTarget.value })} class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-[var(--ui-text)]" /></label>{/if}
								{#if node.type === 'data-store'}<label class="flex flex-col gap-1">หมายเลข Data Store<input value={node.storeNumber ?? ''} maxlength="10" placeholder="D1" oninput={(event) => diagram.updateDFDNode(node.id, { storeNumber: event.currentTarget.value })} class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-[var(--ui-text)]" /></label>{/if}
							</fieldset>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>


	{#if selectedDFDFlow}
		{@const fromN = diagram.dfdNodes.find(n => n.id === selectedDFDFlow.fromNodeId)}
		{@const toN = diagram.dfdNodes.find(n => n.id === selectedDFDFlow.toNodeId)}
		<fieldset disabled={collab.connected && !collab.canEdit(selectedDFDFlow.id)} class="flex flex-col gap-2 rounded-lg border border-[var(--ui-text-secondary)]/30 bg-[var(--ui-bg-tertiary)] p-3">
			<span class="text-xs font-normal text-[var(--ui-text-secondary)] uppercase tracking-wider">แก้ไข Flow</span>
			<span class="text-xs text-[var(--ui-text-muted)]">{fromN?.name ?? '?'} → {toN?.name ?? '?'}</span>
			<input
				type="text"
				value={selectedDFDFlow.label}
				oninput={(e) => diagram.updateDFDFlow(selectedDFDFlow.id, { label: (e.target as HTMLInputElement).value })}
				placeholder="Label..."
				maxlength={MAX_NAME}
				class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
			/>
		</fieldset>
	{/if}


	{#if diagram.dfdVisibleFlows.length > 0}
		<div class="flex flex-col gap-2">
			<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">
				Flows (<AnimatedCounter value={diagram.dfdVisibleFlows.length} />)
			</span>
			<div class="flex flex-col gap-1.5">
				{#each diagram.dfdVisibleFlows as flow (flow.id)}
					{@const from = diagram.dfdNodes.find(n => n.id === flow.fromNodeId)}
					{@const to = diagram.dfdNodes.find(n => n.id === flow.toNodeId)}
					{@const isSelected = diagram.selectedEdgeId === flow.id}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div
						class="flex items-center justify-between rounded-lg border p-2 text-sm transition-all cursor-pointer {isSelected ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)]' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] hover:border-[var(--ui-border)]'}"
						onclick={() => diagram.selectRelationship(flow.id)}
					>
						<span class="truncate text-[var(--ui-text)]">
							{from?.name ?? '?'} → {to?.name ?? '?'} ({flow.label})
						</span>
						<button
							class="shrink-0 rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
							onclick={(e) => { e.stopPropagation(); diagram.removeDFDFlow(flow.id); }}
							aria-label="Remove flow"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
