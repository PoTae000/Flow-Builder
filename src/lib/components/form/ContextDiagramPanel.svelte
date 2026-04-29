<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import type { DFDNodeType } from '$lib/types/context-diagram';
	import AnimatedCounter from '$lib/components/ui/AnimatedCounter.svelte';
	import { DFD_NODE_TYPE_OPTIONS } from '$lib/types/context-diagram';

	let nodeName = $state('');
	let nodeType = $state<DFDNodeType>('process');
	let processNumber = $state('');
	let flowLabel = $state('');
	let flowFrom = $state('');
	let flowTo = $state('');

	const MAX_NAME = 100;

	function addNode() {
		const name = nodeName.trim().slice(0, MAX_NAME);
		if (!name) return;
		const node = diagram.addDFDNode(name, nodeType);
		if (processNumber.trim() && nodeType === 'process') {
			diagram.updateDFDNode(node.id, { processNumber: processNumber.trim() });
		}
		nodeName = '';
		processNumber = '';
	}

	function addFlow() {
		const label = flowLabel.trim();
		if (!label || !flowFrom || !flowTo || flowFrom === flowTo) return;
		diagram.addDFDFlow(label, flowFrom, flowTo);
		flowLabel = '';
		flowFrom = '';
		flowTo = '';
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
				{@const isSelected = diagram.selectedNodeIds.includes(node.id)}
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

	<div class="border-t border-[var(--ui-border)]"></div>

	<!-- Add Flow -->
	<div class="flex flex-col gap-2">
		<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">เพิ่ม Data Flow</span>
		<input
			type="text"
			bind:value={flowLabel}
			placeholder="Flow label..."
			maxlength={MAX_NAME}
			class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
		/>
		<div class="flex gap-2">
			<select
				bind:value={flowFrom}
				class="flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-2 text-sm text-[var(--ui-text)]"
			>
				<option value="">From...</option>
				{#each diagram.dfdNodes as node}
					<option value={node.id}>{node.name}</option>
				{/each}
			</select>
			<span class="flex items-center text-[var(--ui-text-muted)]">&rarr;</span>
			<select
				bind:value={flowTo}
				class="flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-2 text-sm text-[var(--ui-text)]"
			>
				<option value="">To...</option>
				{#each diagram.dfdNodes as node}
					<option value={node.id}>{node.name}</option>
				{/each}
			</select>
		</div>
		<button
			onclick={addFlow}
			disabled={!flowLabel.trim() || !flowFrom || !flowTo || flowFrom === flowTo}
			class="w-full rounded-lg bg-[var(--ui-accent)] px-4 py-2 text-sm font-normal text-[var(--ui-accent-text)] shadow-sm transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
		>
			เพิ่ม Flow
		</button>
	</div>

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
