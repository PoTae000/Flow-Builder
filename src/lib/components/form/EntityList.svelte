<script lang="ts">
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { sanitizeName } from '$lib/utils/sanitize';
	import type { AttributeType } from '$lib/types/er';
	import AttributeForm from './AttributeForm.svelte';
	import AnimatedCounter from '$lib/components/ui/AnimatedCounter.svelte';

	let { searchQuery = '' }: { searchQuery?: string } = $props();

	const filteredEntities = $derived(
		searchQuery
			? diagram.entities.filter((e) => {
				const q = searchQuery.toLowerCase();
				return e.name.toLowerCase().includes(q) ||
					e.attributes.some((a) => a.name.toLowerCase().includes(q));
			})
			: diagram.entities
	);

	let editingId = $state<string | null>(null);
	let editName = $state('');

	function startEdit(id: string, name: string) {
		editingId = id;
		editName = name;
	}

	function saveEdit(id: string) {
		const name = sanitizeName(editName);
		if (name) {
			diagram.updateEntity(id, { name });
		}
		editingId = null;
	}

	function handleEditKeydown(e: KeyboardEvent, id: string) {
		if (e.key === 'Enter') saveEdit(id);
		if (e.key === 'Escape') editingId = null;
	}

	// Attribute inline editing
	let editingAttrId = $state<string | null>(null);
	let editingAttrEntityId = $state<string | null>(null);
	let editAttrName = $state('');
	let editAttrType = $state<AttributeType>('regular');

	function startAttrEdit(entityId: string, attrId: string, name: string, type: AttributeType) {
		editingAttrEntityId = entityId;
		editingAttrId = attrId;
		editAttrName = name;
		editAttrType = type;
	}

	function saveAttrEdit() {
		const name = sanitizeName(editAttrName);
		if (editingAttrEntityId && editingAttrId && name) {
			diagram.updateAttribute(editingAttrEntityId, editingAttrId, {
				name,
				type: editAttrType
			});
		}
		editingAttrId = null;
		editingAttrEntityId = null;
	}

	function handleAttrEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') saveAttrEdit();
		if (e.key === 'Escape') { editingAttrId = null; editingAttrEntityId = null; }
	}

	function autofocus(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	// Collapsible drawer
	let expandedEntities = $state(new Set<string>());

	function toggleExpandOnly(entityId: string, e: MouseEvent) {
		e.stopPropagation();
		const next = new Set(expandedEntities);
		if (next.has(entityId)) next.delete(entityId);
		else next.add(entityId);
		expandedEntities = next;
	}

	function handleEntityClick(entityId: string) {
		const isAlreadySelected = diagram.selectedNodeIdSet.has(entityId);
		diagram.selectEntity(entityId);
		if (isAlreadySelected) {
			// Already selected → toggle drawer
			const next = new Set(expandedEntities);
			if (next.has(entityId)) next.delete(entityId);
			else next.add(entityId);
			expandedEntities = next;
		} else {
			// Newly selected → expand
			if (!expandedEntities.has(entityId)) {
				const next = new Set(expandedEntities);
				next.add(entityId);
				expandedEntities = next;
			}
		}
	}

	// Drag-to-reorder attributes
	let dragAttrId = $state<string | null>(null);
	let dragEntityId = $state<string | null>(null);
	let dragOverAttrId = $state<string | null>(null);
</script>

{#if diagram.entities.length > 0}
	<div class="flex flex-col gap-1.5">
		<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">Entities (<AnimatedCounter value={diagram.entities.length} />)</span>

		<div class="flex flex-col gap-2">
			{#each filteredEntities as entity (entity.id)}
				{@const isSelected = diagram.selectedNodeIdSet.has(entity.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
				<div
					class="min-w-0 cursor-pointer overflow-hidden rounded-lg border p-3 transition-all duration-150 {isSelected ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)] shadow-sm' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] hover:border-[var(--ui-border)] hover:translate-x-0.5 hover:shadow-sm'}"
					onclick={() => handleEntityClick(entity.id)}
				>
					<!-- Entity header -->
					<div class="flex items-center justify-between gap-2">
						<!-- Chevron toggle -->
						{#if entity.attributes.length > 0}
							<button
								class="shrink-0 rounded p-0.5 text-[var(--ui-text-muted)] transition-transform duration-200 hover:text-[var(--ui-text-secondary)] {expandedEntities.has(entity.id) ? 'rotate-90' : ''}"
								onclick={(e) => toggleExpandOnly(entity.id, e)}
								aria-label={expandedEntities.has(entity.id) ? 'Collapse attributes' : 'Expand attributes'}
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
							</button>
						{:else}
							<span class="w-4"></span>
						{/if}

						{#if editingId === entity.id}
							<input
								type="text"
								bind:value={editName}
								onkeydown={(e) => handleEditKeydown(e, entity.id)}
								onblur={() => saveEdit(entity.id)}
								use:autofocus
								maxlength={100}
								class="flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1 text-sm font-light text-[var(--ui-text)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
							/>
						{:else}
							<div class="flex flex-1 min-w-0 items-center">
								<button
									class="w-fit text-left text-sm font-normal text-[var(--ui-text)] transition hover:opacity-80"
									ondblclick={() => startEdit(entity.id, entity.name)}
								>
									{entity.name}
								</button>
								{#if entity.isWeak}
									<span class="ml-1 text-xs text-amber-500">(weak)</span>
								{/if}
								{#if entity.isLocked}
									<span class="ml-1 text-xs text-blue-500">(locked)</span>
								{/if}
								{#if entity.attributes.length > 0 && !expandedEntities.has(entity.id)}
									<span class="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ui-bg-tertiary)] px-1 text-[10px] text-[var(--ui-text-muted)]">{entity.attributes.length}</span>
								{/if}
							</div>
						{/if}

						<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
						<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
							<button
								class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text-secondary)]"
								onclick={() => diagram.updateEntity(entity.id, { isWeak: !entity.isWeak })}
								title={entity.isWeak ? 'Make strong entity' : 'Make weak entity'}
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />{#if entity.isWeak}<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H8a1 1 0 01-1-1V8z" />{/if}</svg>
							</button>
							<button
								class="rounded p-1 transition {entity.isLocked ? 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-950' : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text-secondary)]'}"
								onclick={() => diagram.toggleLockEntity(entity.id)}
								title={entity.isLocked ? 'Unlock entity' : 'Lock entity position'}
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{#if entity.isLocked}<rect stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x="3" y="11" width="18" height="11" rx="2" ry="2" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11V7a5 5 0 0110 0v4" />{:else}<rect stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x="3" y="11" width="18" height="11" rx="2" ry="2" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11V7a5 5 0 0110 0v0" />{/if}</svg>
							</button>
							<button
								class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
								onclick={async () => {
									const confirmed = await dialog.confirm({
										title: 'ลบ Entity',
										message: `ต้องการลบ "${entity.name}" หรือไม่?`,
										confirmText: 'ลบ',
										cancelText: 'ยกเลิก',
										variant: 'danger'
									});
									if (confirmed) diagram.removeEntity(entity.id);
								}}
								title="Delete entity"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
							</button>
						</div>
					</div>

					<!-- Attribute list (drawer) -->
					{#if entity.attributes.length > 0 && expandedEntities.has(entity.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
						<div class="mt-2 flex flex-col gap-0.5" transition:slide={{ duration: 250 }} onclick={(e) => e.stopPropagation()}>
							{#each entity.attributes as attr, i (attr.id)}
							<div animate:flip={{ duration: 200 }}>
								{#if editingAttrId === attr.id && editingAttrEntityId === entity.id}
									<!-- Inline edit mode -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="flex items-center gap-1 rounded bg-[var(--ui-bg)] px-1.5 py-1"
										onfocusout={(e: FocusEvent) => {
											const container = e.currentTarget as HTMLElement;
											const related = e.relatedTarget as Node | null;
											if (!related || !container.contains(related)) {
												saveAttrEdit();
											}
										}}
									>
										<select
											bind:value={editAttrType}
											class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-1 py-0.5 text-[10px] text-[var(--ui-text)] focus:ring-1 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
										>
											<option value="regular">Reg</option>
											<option value="primary_key">PK</option>
											<option value="foreign_key">FK</option>
											<option value="partial_key">Partial</option>
											<option value="derived">Derived</option>
											<option value="multivalued">Multi</option>
										</select>
										<input
											type="text"
											bind:value={editAttrName}
											onkeydown={handleAttrEditKeydown}
											use:autofocus
											maxlength={100}
											class="min-w-0 flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-1.5 py-0.5 text-xs text-[var(--ui-text)] focus:ring-1 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
										/>
									</div>
								{:else}
									<!-- Display mode -->
									<div
										class="group flex items-center justify-between rounded px-2 py-0.5 text-xs cursor-grab hover:bg-[var(--ui-hover)]"
										class:opacity-30={dragAttrId === attr.id && dragEntityId === entity.id}
										class:border-t-2={dragOverAttrId === attr.id && dragEntityId === entity.id}
										class:border-[var(--ui-accent)]={dragOverAttrId === attr.id && dragEntityId === entity.id}
										draggable="true"
										ondragstart={(e) => {
											dragAttrId = attr.id;
											dragEntityId = entity.id;
											if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
										}}
										ondragover={(e) => {
											if (dragEntityId !== entity.id) return;
											e.preventDefault();
											dragOverAttrId = attr.id;
										}}
										ondragleave={() => { dragOverAttrId = null; }}
										ondrop={(e) => {
											e.preventDefault();
											if (dragAttrId && dragEntityId === entity.id) {
												diagram.reorderAttribute(entity.id, dragAttrId, attr.id);
											}
											dragAttrId = null;
											dragEntityId = null;
											dragOverAttrId = null;
										}}
										ondragend={() => {
											dragAttrId = null;
											dragEntityId = null;
											dragOverAttrId = null;
										}}
									>
										<button
											class="w-fit text-left text-[var(--ui-text-secondary)] transition hover:opacity-80"
											ondblclick={() => startAttrEdit(entity.id, attr.id, attr.name, attr.type)}
										>
											{#if attr.type === 'primary_key'}
												<span class="font-bold text-amber-500">PK</span>
											{:else if attr.type === 'foreign_key'}
												<span class="font-bold text-violet-400">FK</span>
											{/if}
											<span class:underline={attr.type === 'primary_key'}>{attr.name}</span>
										</button>
										<div class="hidden items-center gap-0.5 group-hover:flex">
											<button
												class="rounded p-0.5 text-[var(--ui-text-muted)] transition hover:text-[var(--ui-text)] disabled:opacity-30 disabled:hover:text-[var(--ui-text-muted)]"
												onclick={() => diagram.moveAttribute(entity.id, attr.id, -1)}
												disabled={i === 0}
												aria-label="Move up"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
											</button>
											<button
												class="rounded p-0.5 text-[var(--ui-text-muted)] transition hover:text-[var(--ui-text)] disabled:opacity-30 disabled:hover:text-[var(--ui-text-muted)]"
												onclick={() => diagram.moveAttribute(entity.id, attr.id, 1)}
												disabled={i === entity.attributes.length - 1}
												aria-label="Move down"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
											</button>
											<button
												class="rounded p-0.5 text-[var(--ui-text-muted)] transition hover:text-red-500"
												onclick={() => diagram.removeAttribute(entity.id, attr.id)}
												aria-label="Remove attribute"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
											</button>
										</div>
									</div>
								{/if}
							</div>
							{/each}
						</div>
					{/if}

					<!-- Add attribute form (show only when single-selected & expanded) -->
					{#if isSelected && diagram.selectedEntityId === entity.id && expandedEntities.has(entity.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
						<div class="mt-2 animate-slide-up" onclick={(e) => e.stopPropagation()}>
							<AttributeForm entityId={entity.id} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
