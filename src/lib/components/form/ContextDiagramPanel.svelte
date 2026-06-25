<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import type { DFDNodeType } from '$lib/types/context-diagram';
	import AnimatedCounter from '$lib/components/ui/AnimatedCounter.svelte';
	import { DFD_NODE_TYPE_OPTIONS } from '$lib/types/context-diagram';

	let nodeName = $state('');
	let nodeType = $state<DFDNodeType>('process');
	let processNumber = $state('');
	let storeNumber = $state('');

	// Selected node for editing
	const selectedDFDNode = $derived(
		diagram.selectedNodeIds.length === 1
			? diagram.dfdNodes.find(n => n.id === diagram.selectedNodeIds[0]) ?? null
			: null
	);

	// Selected flow for editing
	const selectedDFDFlow = $derived(
		diagram.selectedEdgeId
			? diagram.dfdFlows.find(f => f.id === diagram.selectedEdgeId) ?? null
			: null
	);

	const MAX_NAME = 100;

	function addNode() {
		const name = nodeName.trim().slice(0, MAX_NAME);
		if (!name) return;
		const node = diagram.addDFDNode(name, nodeType);
		if (processNumber.trim() && nodeType === 'process') {
			diagram.updateDFDNode(node.id, { processNumber: processNumber.trim() });
		}
		if (storeNumber.trim() && nodeType === 'data-store') {
			diagram.updateDFDNode(node.id, { storeNumber: storeNumber.trim() });
		}
		nodeName = '';
		processNumber = '';
		storeNumber = '';
	}

</script>

<div class="flex flex-col gap-5">
	<!-- Add Node -->
	<div class="flex flex-col gap-2">
		<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">เพิ่ม Node</span>
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={nodeName}
				onkeydown={(e) => { if (e.key === 'Enter') addNode(); }}
				placeholder="ชื่อ Node..."
				maxlength={MAX_NAME}
				class="flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
			/>
			<select
				bind:value={nodeType}
				class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-2 text-sm text-[var(--ui-text)]"
			>
				{#each DFD_NODE_TYPE_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>
		{#if nodeType === 'process'}
			<input
				type="text"
				bind:value={processNumber}
				placeholder="Process number (e.g. 1.0)..."
				maxlength={10}
				class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none animate-slide-up"
			/>
		{/if}
		{#if nodeType === 'data-store'}
			<input
				type="text"
				bind:value={storeNumber}
				placeholder="Store ID (e.g. D1)..."
				maxlength={10}
				class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none animate-slide-up"
			/>
		{/if}
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
			Nodes (<AnimatedCounter value={diagram.dfdNodes.length} />)
		</span>
		<div class="flex flex-col gap-1.5">
			{#each diagram.dfdNodes as node (node.id)}
				{@const isSelected = diagram.selectedNodeIdSet.has(node.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div
					class="flex items-center justify-between rounded-lg border p-2 text-sm transition-all cursor-pointer {isSelected ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)]' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] hover:border-[var(--ui-border)]'}"
					onclick={() => diagram.selectEntity(node.id)}
				>
					<div class="flex items-center gap-2 min-w-0">
						<span class="text-xs text-[var(--ui-text-muted)] uppercase">{node.type.replace('-', ' ')}</span>
						{#if node.processNumber}
							<span class="text-xs font-bold text-[var(--ui-text-secondary)]">{node.processNumber}</span>
						{/if}
						{#if node.storeNumber}
							<span class="text-xs font-bold text-[var(--ui-text-secondary)]">{node.storeNumber}</span>
						{/if}
						<span class="truncate text-[var(--ui-text)]">{node.name}</span>
					</div>
					<button
						class="shrink-0 rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
						onclick={(e) => { e.stopPropagation(); diagram.removeDFDNode(node.id); }}
						aria-label="Remove node"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Edit Selected Node -->
	{#if selectedDFDNode}
		<div class="flex flex-col gap-2 rounded-lg border border-[var(--ui-text-secondary)]/30 bg-[var(--ui-bg-tertiary)] p-3">
			<span class="text-xs font-normal text-[var(--ui-text-secondary)] uppercase tracking-wider">แก้ไข Node</span>
			<input
				type="text"
				value={selectedDFDNode.name}
				oninput={(e) => diagram.updateDFDNode(selectedDFDNode.id, { name: (e.target as HTMLInputElement).value })}
				placeholder="ชื่อ Node..."
				maxlength={MAX_NAME}
				class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
			/>
			<select
				value={selectedDFDNode.type}
				onchange={(e) => diagram.updateDFDNode(selectedDFDNode.id, { type: (e.target as HTMLSelectElement).value as DFDNodeType })}
				class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-2 text-sm text-[var(--ui-text)]"
			>
				{#each DFD_NODE_TYPE_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
			{#if selectedDFDNode.type === 'process'}
				<input
					type="text"
					value={selectedDFDNode.processNumber || ''}
					oninput={(e) => diagram.updateDFDNode(selectedDFDNode.id, { processNumber: (e.target as HTMLInputElement).value })}
					placeholder="Process number (e.g. 1.0)..."
					maxlength={10}
					class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
				/>
			{/if}
			{#if selectedDFDNode.type === 'data-store'}
				<input
					type="text"
					value={selectedDFDNode.storeNumber || ''}
					oninput={(e) => diagram.updateDFDNode(selectedDFDNode.id, { storeNumber: (e.target as HTMLInputElement).value })}
					placeholder="Store ID (e.g. D1)..."
					maxlength={10}
					class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
				/>
			{/if}
			<div class="flex gap-2">
				<input
					type="color"
					value={selectedDFDNode.color || '#ffffff'}
					oninput={(e) => diagram.updateDFDNode(selectedDFDNode.id, { color: (e.target as HTMLInputElement).value })}
					class="h-9 w-9 shrink-0 cursor-pointer rounded border border-[var(--ui-border)]"
				/>
				{#if selectedDFDNode.color}
					<button
						onclick={() => diagram.updateDFDNode(selectedDFDNode.id, { color: undefined })}
						class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-1.5 text-xs text-[var(--ui-text-muted)] hover:border-[var(--ui-text-muted)]"
					>
						ล้างสี
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Edit Selected Flow -->
	{#if selectedDFDFlow}
		{@const fromN = diagram.dfdNodes.find(n => n.id === selectedDFDFlow.fromNodeId)}
		{@const toN = diagram.dfdNodes.find(n => n.id === selectedDFDFlow.toNodeId)}
		<div class="flex flex-col gap-2 rounded-lg border border-[var(--ui-text-secondary)]/30 bg-[var(--ui-bg-tertiary)] p-3">
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
		</div>
	{/if}

	<!-- Flow List -->
	{#if diagram.dfdFlows.length > 0}
		<div class="flex flex-col gap-2">
			<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">
				Flows (<AnimatedCounter value={diagram.dfdFlows.length} />)
			</span>
			<div class="flex flex-col gap-1.5">
				{#each diagram.dfdFlows as flow (flow.id)}
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
