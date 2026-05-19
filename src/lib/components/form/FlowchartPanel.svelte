<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import type { FlowNodeType } from '$lib/types/flowchart';
	import AnimatedCounter from '$lib/components/ui/AnimatedCounter.svelte';

	let nodeName = $state('');
	let nodeType = $state<FlowNodeType>('process');

	const MAX_NAME = 100;

	const selectedNode = $derived(diagram.flowNodes.find(n => diagram.selectedNodeIdSet.has(n.id)));

	const shapeOptions: { type: FlowNodeType; label: string }[] = [
		{ type: 'process', label: 'Process' },
		{ type: 'decision', label: 'Decision' },
		{ type: 'start-end', label: 'Start/End' },
		{ type: 'input-output', label: 'I/O' },
		{ type: 'connector', label: 'Connector' },
		{ type: 'document', label: 'Document' },
		{ type: 'database', label: 'Database' },
		{ type: 'predefined-process', label: 'Predef.' },
		{ type: 'manual-operation', label: 'Manual' },
		{ type: 'preparation', label: 'Prepare' },
		{ type: 'delay', label: 'Delay' },
		{ type: 'display', label: 'Display' },
		{ type: 'internal-storage', label: 'Storage' }
	];

	function addNode() {
		const name = nodeName.trim().slice(0, MAX_NAME);
		if (!name) return;
		diagram.addFlowNode(name, nodeType);
		nodeName = '';
	}
</script>

{#snippet shapeIcon(type: FlowNodeType, size: number)}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		{#if type === 'process'}
			<rect x="3" y="6" width="18" height="12" rx="1" />
		{:else if type === 'decision'}
			<polygon points="12,3 22,12 12,21 2,12" />
		{:else if type === 'start-end'}
			<rect x="3" y="6" width="18" height="12" rx="6" />
		{:else if type === 'input-output'}
			<polygon points="6,6 22,6 18,18 2,18" />
		{:else if type === 'connector'}
			<circle cx="12" cy="12" r="8" />
		{:else if type === 'document'}
			<path d="M3,6 h18 v9 q-4.5,3 -9,0 q-4.5,-3 -9,0 Z" />
		{:else if type === 'database'}
			<path d="M3,8 a9,3 0 0,1 18,0 v8 a9,3 0 0,1 -18,0 Z" />
			<ellipse cx="12" cy="8" rx="9" ry="3" />
		{:else if type === 'predefined-process'}
			<rect x="3" y="6" width="18" height="12" rx="1" />
			<line x1="6" y1="6" x2="6" y2="18" />
			<line x1="18" y1="6" x2="18" y2="18" />
		{:else if type === 'manual-operation'}
			<polygon points="3,6 21,6 18,18 6,18" />
		{:else if type === 'preparation'}
			<polygon points="7,6 17,6 22,12 17,18 7,18 2,12" />
		{:else if type === 'delay'}
			<path d="M3,6 h12 a6,6 0 0,1 0,12 h-12 Z" />
		{:else if type === 'display'}
			<path d="M7,6 h8 a6,6 0 0,1 0,12 h-8 l-4,-6 Z" />
		{:else if type === 'internal-storage'}
			<rect x="3" y="6" width="18" height="12" rx="1" />
			<line x1="7" y1="6" x2="7" y2="18" />
			<line x1="3" y1="10" x2="21" y2="10" />
		{/if}
	</svg>
{/snippet}

<div class="flex flex-col gap-5">
	<!-- Auto Layout -->
	{#if diagram.flowNodes.length > 0}
		<div class="flex flex-col gap-2">
			<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">จัดวาง Layout</span>

			<div class="grid grid-cols-2 gap-2">
				<button
					onclick={() => diagram.applyFlowchartLayout('hierarchical-tb')}
					class="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] transition hover:border-[var(--ui-border)] hover:bg-[var(--ui-bg-tertiary)]"
					title="จัดวางแบบลำดับชั้น บนลงล่าง"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
					</svg>
					บนลงล่าง
				</button>

				<button
					onclick={() => diagram.applyFlowchartLayout('hierarchical-lr')}
					class="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] transition hover:border-[var(--ui-border)] hover:bg-[var(--ui-bg-tertiary)]"
					title="จัดวางแบบลำดับชั้น ซ้ายไปขวา"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
					</svg>
					ซ้ายไปขวา
				</button>

				<button
					onclick={() => diagram.applyFlowchartLayout('grid')}
					class="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] transition hover:border-[var(--ui-border)] hover:bg-[var(--ui-bg-tertiary)]"
					title="จัดวางแบบตาราง"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
					</svg>
					ตาราง
				</button>

				<button
					onclick={() => diagram.applyFlowchartLayout('circular')}
					class="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] transition hover:border-[var(--ui-border)] hover:bg-[var(--ui-bg-tertiary)]"
					title="จัดวางแบบวงกลม"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<circle cx="12" cy="12" r="9" stroke-width="2" />
					</svg>
					วงกลม
				</button>

				<button
					onclick={() => diagram.applyFlowchartLayout('force')}
					class="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] transition hover:border-[var(--ui-border)] hover:bg-[var(--ui-bg-tertiary)]"
					title="จัดวางแบบแรงดึงดูด"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
					Force-Directed
				</button>
			</div>
		</div>
	{/if}

	<!-- Add Node -->
	<div class="flex flex-col gap-2">
		<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">เพิ่ม Node</span>

		<!-- Shape Palette -->
		<div class="grid grid-cols-5 gap-1">
			{#each shapeOptions as opt}
				<button
					onclick={() => nodeType = opt.type}
					class="flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[10px] transition {nodeType === opt.type ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)]' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] text-[var(--ui-text-muted)] hover:border-[var(--ui-border)]'}"
					aria-label="Select {opt.label} shape"
				>
					{@render shapeIcon(opt.type, 20)}
					<span>{opt.label}</span>
				</button>
			{/each}
		</div>

		<div class="flex gap-2">
			<input
				type="text"
				bind:value={nodeName}
				onkeydown={(e) => { if (e.key === 'Enter') addNode(); }}
				placeholder="ชื่อ Node..."
				maxlength={MAX_NAME}
				class="flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
			/>
		</div>
		<button
			onclick={addNode}
			disabled={!nodeName.trim()}
			class="w-full rounded-lg bg-[var(--ui-accent)] px-4 py-2 text-sm font-normal text-[var(--ui-accent-text)] shadow-sm transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
		>
			เพิ่ม Node
		</button>
	</div>

	<!-- Node List -->
	<div class="flex flex-col gap-2">
		<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">
			Nodes (<AnimatedCounter value={diagram.flowNodes.length} />)
		</span>
		<div class="flex flex-col gap-1.5">
			{#each diagram.flowNodes as node (node.id)}
				{@const isSelected = diagram.selectedNodeIdSet.has(node.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div
					class="flex items-center justify-between rounded-lg border p-2 text-sm transition-all cursor-pointer {isSelected ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)]' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] hover:border-[var(--ui-border)]'}"
					onclick={() => diagram.selectEntity(node.id)}
				>
					<div class="flex items-center gap-2 min-w-0">
						<span class="shrink-0 text-[var(--ui-text-muted)]">
							{@render shapeIcon(node.type, 16)}
						</span>
						<span class="truncate text-[var(--ui-text)]">{node.name}</span>
					</div>
					<button
						class="shrink-0 rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
						onclick={(e) => { e.stopPropagation(); diagram.removeFlowNode(node.id); }}
						aria-label="Remove node"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Edit Selected Node -->
	{#if selectedNode && selectedNode.type === 'start-end'}
		<div class="flex flex-col gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3">
			<span class="text-xs font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">ปรับความโค้งมุม</span>
			<div class="flex items-center gap-3">
				<input
					type="range"
					min="0"
					max="50"
					step="1"
					value={selectedNode.borderRadius ?? 20}
					oninput={(e) => diagram.updateFlowNode(selectedNode.id, { borderRadius: parseInt(e.currentTarget.value) })}
					class="flex-1"
				/>
				<span class="text-sm font-mono text-[var(--ui-text)]">{selectedNode.borderRadius ?? 20}px</span>
			</div>
		</div>
	{/if}


	<!-- Edge List -->
	{#if diagram.flowEdges.length > 0}
		<div class="flex flex-col gap-2">
			<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">
				Edges (<AnimatedCounter value={diagram.flowEdges.length} />)
			</span>
			<div class="flex flex-col gap-1.5">
				{#each diagram.flowEdges as edge (edge.id)}
					{@const from = diagram.flowNodes.find(n => n.id === edge.fromNodeId)}
					{@const to = diagram.flowNodes.find(n => n.id === edge.toNodeId)}
					{@const isSelected = diagram.selectedEdgeId === edge.id}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div
						class="flex items-center justify-between rounded-lg border p-2 text-sm transition-all cursor-pointer {isSelected ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)]' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] hover:border-[var(--ui-border)]'}"
						onclick={() => diagram.selectRelationship(edge.id)}
					>
						<div class="flex items-center gap-1.5 min-w-0">
							{#if edge.condition}
								<span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium {edge.condition === 'yes' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'}">
									{edge.condition === 'yes' ? 'Y' : 'N'}
								</span>
							{/if}
							<span class="truncate text-[var(--ui-text)]">
								{from?.name ?? '?'} → {to?.name ?? '?'}{edge.label ? ` (${edge.label})` : ''}
							</span>
						</div>
						<button
							class="shrink-0 rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
							onclick={(e) => { e.stopPropagation(); diagram.removeFlowEdge(edge.id); }}
							aria-label="Remove edge"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- Edge Style Editor (when edge selected) -->
		{#if diagram.selectedEdgeId}
			{@const edge = diagram.flowEdges.find(e => e.id === diagram.selectedEdgeId)}
			{#if edge}
				<div class="flex flex-col gap-2 border-t border-[var(--ui-border)] pt-3">
					<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">แก้ไข Edge</span>

					<!-- Label -->
					<div class="flex flex-col gap-1">
						<label class="text-xs text-[var(--ui-text-muted)]">Label</label>
						<input
							type="text"
							value={edge.label}
							oninput={(e) => diagram.updateFlowEdge(edge.id, { label: e.currentTarget.value })}
							placeholder="Edge label"
							class="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)]"
						/>
					</div>

					<!-- Line Style -->
					<div class="flex flex-col gap-1">
						<label class="text-xs text-[var(--ui-text-muted)]">Line Style</label>
						<select
							value={edge.lineStyle || 'orthogonal'}
							onchange={(e) => diagram.updateFlowEdge(edge.id, { lineStyle: e.currentTarget.value as any })}
							class="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-sm text-[var(--ui-text)]"
						>
							<option value="orthogonal">Orthogonal</option>
							<option value="straight">Straight</option>
							<option value="curved">Curved</option>
						</select>
					</div>

					<!-- Stroke Dash -->
					<div class="flex flex-col gap-1">
						<label class="text-xs text-[var(--ui-text-muted)]">Stroke</label>
						<select
							value={edge.strokeDash || 'solid'}
							onchange={(e) => diagram.updateFlowEdge(edge.id, { strokeDash: e.currentTarget.value as any })}
							class="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-sm text-[var(--ui-text)]"
						>
							<option value="solid">Solid</option>
							<option value="dashed">Dashed</option>
							<option value="dotted">Dotted</option>
						</select>
					</div>

					<!-- Stroke Width -->
					<div class="flex flex-col gap-1">
						<label class="text-xs text-[var(--ui-text-muted)]">Width: {edge.strokeWidth || 1.5}px</label>
						<input
							type="range"
							min="1"
							max="5"
							step="0.5"
							value={edge.strokeWidth || 1.5}
							oninput={(e) => diagram.updateFlowEdge(edge.id, { strokeWidth: parseFloat(e.currentTarget.value) })}
							class="w-full"
						/>
					</div>

					<!-- Edge Color -->
					<div class="flex flex-col gap-1">
						<label class="text-xs text-[var(--ui-text-muted)]">Color</label>
						<input
							type="color"
							value={edge.edgeColor || '#6b7280'}
							onchange={(e) => diagram.updateFlowEdge(edge.id, { edgeColor: e.currentTarget.value })}
							class="w-full h-8 rounded border border-[var(--ui-border)] cursor-pointer"
						/>
					</div>

					<!-- Reset Waypoints Button -->
					{#if edge.waypoints && edge.waypoints.length > 0}
						<button
							class="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-1.5 text-sm text-[var(--ui-text)] transition hover:bg-[var(--ui-bg-tertiary)]"
							onclick={() => diagram.updateFlowEdge(edge.id, { waypoints: undefined })}
						>
							Reset Path
						</button>
					{/if}
				</div>
			{/if}
		{/if}
	{/if}
</div>
