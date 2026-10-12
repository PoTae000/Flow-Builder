<script lang="ts">
	import { slide } from 'svelte/transition';
	import { collab } from '$lib/stores/collab.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import type { CardinalityType, Relationship } from '$lib/types/er';
	import AnimatedCounter from '$lib/components/ui/AnimatedCounter.svelte';

	let { searchQuery = '' }: { searchQuery?: string } = $props();


 let editingNameId = $state<string | null>(null); let draftName = $state('');
 function focusName(node: HTMLInputElement) { node.focus(); node.setSelectionRange(node.value.length, node.value.length); }
 function saveName() { if (editingNameId) diagram.updateRelationship(editingNameId, {name: draftName.trim()}); editingNameId = null; }

	let expandedRels = $state(new Set<string>());

	function handleRelClick(relId: string) {
		const isAlreadySelected = diagram.selectedEdgeId === relId;
		diagram.selectRelationship(relId);
		if (isAlreadySelected) {
			const next = new Set(expandedRels);
			if (next.has(relId)) next.delete(relId);
			else next.add(relId);
			expandedRels = next;
		} else {
			if (!expandedRels.has(relId)) {
				const next = new Set(expandedRels);
				next.add(relId);
				expandedRels = next;
			}
		}
	}

	function toggleExpandOnly(relId: string, e: MouseEvent) {
		e.stopPropagation();
		const next = new Set(expandedRels);
		if (next.has(relId)) next.delete(relId);
		else next.add(relId);
		expandedRels = next;
	}

	async function handleDelete(relId: string, relName: string) {
		const confirmed = await dialog.confirm({
			title: 'ลบความสัมพันธ์',
			message: `ต้องการลบ "${relName}" หรือไม่?`,
			confirmText: 'ลบ',
			cancelText: 'ยกเลิก',
			variant: 'danger'
		});
		if (confirmed) diagram.removeRelationship(relId);
	}

	function getEntityName(id: string): string {
		return diagram.entityMap.get(id)?.name ?? 'Unknown';
	}

	const filteredRelationships = $derived(
		searchQuery
			? diagram.relationships.filter((r) => {
				const q = searchQuery.toLowerCase();
				return r.name.toLowerCase().includes(q) ||
					getEntityName(r.entityIds[0]).toLowerCase().includes(q) ||
					getEntityName(r.entityIds[1]).toLowerCase().includes(q);
			})
			: diagram.relationships
	);

	const cardinalityOptions: { value: CardinalityType; label: string }[] = [
		{ value: '1', label: '1 (one)' },
		{ value: 'N', label: 'N (many)' },
		{ value: 'M', label: 'M (many)' },
		{ value: '0..1', label: '0..1' },
		{ value: '0..N', label: '0..N' },
		{ value: '1..1', label: '1..1' },
		{ value: '1..N', label: '1..N' }
	];
</script>

{#if diagram.relationships.length > 0}
	<div class="flex flex-col gap-1.5">
		<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">
			ความสัมพันธ์ (<AnimatedCounter value={diagram.relationships.length} />)
		</span>

		<div class="flex flex-col gap-1.5">
			{#each filteredRelationships as rel (rel.id)}
				{@const isSelected = diagram.selectedEdgeId === rel.id}
				{@const isExpanded = isSelected && expandedRels.has(rel.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
				<div
					class="min-w-0 cursor-pointer overflow-hidden rounded-lg border transition-all {isSelected ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)]' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] hover:border-[var(--ui-border)] hover:translate-x-0.5 hover:shadow-sm'}"
					onclick={() => handleRelClick(rel.id)}
				>

					<div class="flex items-center justify-between px-3 py-2">
						<div class="flex min-w-0 flex-1 items-center gap-1.5">

							<button
								class="shrink-0 rounded p-0.5 text-[var(--ui-text-muted)] transition-transform duration-200 hover:text-[var(--ui-text-secondary)] {isExpanded ? 'rotate-90' : ''}"
								onclick={(e) => toggleExpandOnly(rel.id, e)}
								aria-label={isExpanded ? 'Collapse relationship' : 'Expand relationship'}
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
							</button>

							<span class="min-w-0 text-left text-sm">
								<span class="font-light text-[var(--ui-text)]">{getEntityName(rel.entityIds[0])}</span>
								{#if editingNameId === rel.id}
<input use:focusName bind:value={draftName} aria-label="ชื่อความสัมพันธ์" onblur={saveName} onclick={(e) => e.stopPropagation()} onkeydown={(e) => { e.stopPropagation(); if(e.isComposing) return; if(e.key === 'Enter') {e.preventDefault();saveName();} if(e.key === 'Escape') {e.preventDefault();editingNameId=null;} }} class="mx-1 min-w-0 w-20 bg-transparent text-xs text-[var(--ui-text)] outline-none" />
{:else}
<button class="mx-1.5 text-xs text-[var(--ui-text-muted)]" onclick={(e) => e.stopPropagation()} ondblclick={async (e) => { e.stopPropagation(); if(diagram.viewOnly || collab.isViewer || !await collab.acquireLocks([rel.id])) return; draftName=rel.name; editingNameId=rel.id; }}>{rel.name.trim() ? `--[${rel.name}]--` : '——'}</button>
{/if}
								<span class="font-light text-[var(--ui-text)]">{getEntityName(rel.entityIds[1])}</span>
								<span class="ml-2 text-xs text-red-500">
									({rel.cardinalities[0]} : {rel.cardinalities[1]})
								</span>
							</span>
						</div>

						<button
							class="shrink-0 rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
							onclick={(e) => { e.stopPropagation(); handleDelete(rel.id, rel.name); }}
							title="Delete relationship"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
						</button>
					</div>


					{#if isExpanded}
						<label class="flex flex-col gap-1 px-3 pt-2 text-xs text-[var(--ui-text-muted)]">
							ทิศทาง Data Flow
							<select class="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-[var(--ui-text)]" value={rel.dataFlowDirection ?? 'none'} onchange={(event) => diagram.updateRelationship(rel.id, { dataFlowDirection: event.currentTarget.value as Relationship['dataFlowDirection'] })}>
								<option value="none">ไม่ระบุ</option>
								<option value="forward">{getEntityName(rel.entityIds[0])} → {getEntityName(rel.entityIds[1])}</option>
								<option value="reverse">{getEntityName(rel.entityIds[1])} → {getEntityName(rel.entityIds[0])}</option>
								<option value="both">ทั้งสองทิศทาง ↔</option>
							</select>
						</label>
						<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
						<div class="flex flex-col gap-2.5 border-t border-[var(--ui-border-light)] px-3 py-2.5" transition:slide={{ duration: 250 }} onclick={(e) => e.stopPropagation()}>

							<div class="flex flex-col gap-1">
								<span class="text-xs text-[var(--ui-text-muted)]">ชื่อ (ไม่บังคับ)</span>
								<input
									type="text"
									value={rel.name}
									placeholder="เว้นว่างเพื่อไม่แสดง label"
									oninput={(e) => diagram.updateRelationship(rel.id, { name: (e.target as HTMLInputElement).value })}
									class="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2.5 py-1.5 text-sm text-[var(--ui-text)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
								/>
							</div>


							<div class="grid grid-cols-2 gap-2">
								<div class="flex flex-col gap-1">
									<span class="text-xs text-[var(--ui-text-muted)]">{getEntityName(rel.entityIds[0])}</span>
									<select
										value={rel.cardinalities[0]}
										onchange={(e) => diagram.updateRelationship(rel.id, { cardinalities: [(e.target as HTMLSelectElement).value as CardinalityType, rel.cardinalities[1]] })}
										class="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-sm text-[var(--ui-text)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
									>
										{#each cardinalityOptions as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								</div>
								<div class="flex flex-col gap-1">
									<span class="text-xs text-[var(--ui-text-muted)]">{getEntityName(rel.entityIds[1])}</span>
									<select
										value={rel.cardinalities[1]}
										onchange={(e) => diagram.updateRelationship(rel.id, { cardinalities: [rel.cardinalities[0], (e.target as HTMLSelectElement).value as CardinalityType] })}
										class="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-sm text-[var(--ui-text)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
									>
										{#each cardinalityOptions as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								</div>
							</div>





							<label class="flex cursor-pointer items-center gap-2.5 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2.5 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]">
								<span class="relative flex h-4 w-4 shrink-0 items-center justify-center">
								<input
									type="checkbox"
									checked={rel.isIdentifying}
									onchange={(e) => diagram.updateRelationship(rel.id, { isIdentifying: (e.target as HTMLInputElement).checked })}
									style="width: 16px; height: 16px; min-width: 16px; min-height: 16px; margin: 0;"
									class="peer absolute inset-0 h-4 w-4 cursor-pointer appearance-none rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] transition checked:border-[var(--ui-accent)] checked:bg-[var(--ui-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-bg)]"
								/>
 <svg aria-hidden="true" class="pointer-events-none relative h-3 w-3 text-[var(--ui-accent-text)] opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="m5 12 4 4 10-10" /></svg>
 </span>
								<span class="flex flex-1 items-center justify-between gap-1.5">
									Identifying
									<svg class="h-4 w-10" viewBox="0 0 40 16">
										{#if rel.isIdentifying}
											<line x1="0" y1="8" x2="40" y2="8" stroke="currentColor" stroke-width="1.5" />
										{:else}
											<line x1="0" y1="8" x2="40" y2="8" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3" />
										{/if}
									</svg>
								</span>
							</label>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
