<script lang="ts">
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { collab } from '$lib/stores/collab.svelte';
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
	let menuEntityId = $state<string | null>(null);
	let addingEntityId = $state<string | null>(null);

	async function startEdit(id: string, name: string) {
		diagram.selectEntity(id);
		if (!await collab.acquireLocks([id])) return;
		editingId = id;
		editName = name;
	}

	function saveEdit(id: string) {
		if (editingId !== id) return;
		const name = sanitizeName(editName);
		if (name && name !== diagram.entities.find(e => e.id === id)?.name) {
			diagram.updateEntity(id, { name });
		}
		editingId = null;
	}

	function handleEditKeydown(e: KeyboardEvent, id: string) {
		if (e.isComposing) return;
		if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); saveEdit(id); }
		if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); editingId = null; }
	}


	let editingAttrId = $state<string | null>(null);
	let editingAttrEntityId = $state<string | null>(null);
	let editAttrName = $state('');
	let editAttrType = $state<AttributeType>('regular');

	async function startAttrEdit(entityId: string, attrId: string, name: string, type: AttributeType) {
		if (diagram.viewOnly || collab.isViewer) return;
		diagram.selectEntity(entityId);
		if (!await collab.acquireLocks([entityId])) return;
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
		if (e.isComposing) return;
		if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); saveAttrEdit(); }
		if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); editingAttrId = null; editingAttrEntityId = null; }
	}

	function autofocus(node: HTMLInputElement) {
		node.focus();
		node.select();
	}


	let expandedEntities = $state(new Set<string>());

	function toggleExpandOnly(entityId: string, e: MouseEvent) {
		e.stopPropagation();
		const opening = !expandedEntities.has(entityId);
		expandedEntities = opening ? new Set([entityId]) : new Set();
		addingEntityId = null;
		menuEntityId = null;
		if (opening) diagram.selectEntity(entityId);
	}

	function handleEntityClick(entityId: string) {
		const opening = !expandedEntities.has(entityId);
		diagram.selectEntity(entityId);
		expandedEntities = opening ? new Set([entityId]) : new Set();
		addingEntityId = null;
		menuEntityId = null;
	}

	let dragAttrId = $state<string | null>(null);
	let dragEntityId = $state<string | null>(null);
	let dragOverAttrId = $state<string | null>(null);
</script>

{#if diagram.entities.length > 0}
	<div class="flex flex-col gap-1.5">
		<div class="flex items-center justify-between text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider"><span>Entities</span><span>(<AnimatedCounter value={diagram.entities.length} />)</span></div>

		<div class="flex flex-col gap-2">
			{#each filteredEntities as entity (entity.id)}
				{@const isSelected = diagram.selectedNodeIdSet.has(entity.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
				<div
					class="min-w-0 cursor-pointer overflow-hidden rounded-lg border p-3 transition-all duration-150 {isSelected ? 'border-[var(--ui-accent)] bg-[var(--ui-bg-secondary)] shadow-sm' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)]'}"
					onclick={() => handleEntityClick(entity.id)}
				>

					<div class="flex items-center justify-between gap-2">

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
								onclick={(e) => e.stopPropagation()}
								ondblclick={(e) => e.stopPropagation()}
								use:autofocus
								maxlength={100}
								class="flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1 text-sm font-light text-[var(--ui-text)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
							/>
						{:else}
							<div class="flex flex-1 min-w-0 items-center">
								<button
									class="w-fit text-left text-sm font-normal text-[var(--ui-text)]"
									onclick={(e) => { e.stopPropagation(); handleEntityClick(entity.id); }}
									ondblclick={(e) => e.stopPropagation()}
								>
									{entity.name}
								</button>



							</div>
						{/if}

<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
							<button
								class="rounded p-1 transition {entity.isWeak ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950' : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text-secondary)]'}"
								onclick={() => diagram.updateEntity(entity.id, { isWeak: !entity.isWeak })}
								title={entity.isWeak ? 'Weak Entity (คลิกเพื่อเปลี่ยนเป็น Strong)' : 'ทำเป็น Weak Entity (สี่เหลี่ยมสองชั้น)'}
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
								title="ลบ Entity"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
							</button>
						</div>
<button title="รูปแบบข้อความ" aria-label={`รูปแบบข้อความ ${entity.name}`} aria-expanded={menuEntityId === entity.id} onclick={(e) => { e.stopPropagation(); menuEntityId = menuEntityId === entity.id ? null : entity.id; }} class="rounded px-2 py-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
					</div>



						{#if menuEntityId === entity.id}
<div class="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2" onclick={(e) => e.stopPropagation()}>
							<span class="w-full text-[11px] text-[var(--ui-text-muted)]">รูปแบบข้อความของ Entity</span>
							<button
								onclick={() => diagram.updateEntity(entity.id, { bold: !(entity.bold ?? true) })}
								class="flex h-7 w-7 items-center justify-center rounded border text-xs font-bold transition {(entity.bold ?? true) ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg)] text-[var(--ui-text)]' : 'border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'}"
								title="ตัวหนา"
							>B</button>
							<button
								onclick={() => diagram.updateEntity(entity.id, { italic: !(entity.italic ?? false) })}
								class="flex h-7 w-7 items-center justify-center rounded border text-xs italic transition {(entity.italic ?? false) ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg)] text-[var(--ui-text)]' : 'border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'}"
								title="ตัวเอียง"
							>I</button>
							<div class="ml-auto flex items-center gap-1">
								<button
									onclick={() => diagram.updateEntity(entity.id, { fontSize: Math.max(8, (entity.fontSize ?? diagram.diagramFontSize) - 1) })}
									class="flex h-7 w-7 items-center justify-center rounded border border-[var(--ui-border)] text-[var(--ui-text-muted)] transition hover:text-[var(--ui-text)]"
									title="เล็กลง"
								>−</button>
								<span class="w-8 text-center text-xs font-mono text-[var(--ui-text)]">{entity.fontSize ?? diagram.diagramFontSize}</span>
								<button
									onclick={() => diagram.updateEntity(entity.id, { fontSize: Math.min(48, (entity.fontSize ?? diagram.diagramFontSize) + 1) })}
									class="flex h-7 w-7 items-center justify-center rounded border border-[var(--ui-border)] text-[var(--ui-text-muted)] transition hover:text-[var(--ui-text)]"
									title="ใหญ่ขึ้น"
								>+</button>
							</div>
						</div>
{/if}

					{#if entity.attributes.length > 0 && expandedEntities.has(entity.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
						<div class="mt-2 flex flex-col gap-0.5" transition:slide={{ duration: 250 }} onclick={(e) => e.stopPropagation()}>
							<div class="mb-1 flex items-center justify-between border-b border-[var(--ui-border-light)] pb-2 text-[11px] text-[var(--ui-text-muted)]"><span>Attributes</span><span class="tabular-nums">({entity.attributes.length})</span></div>
							{#each entity.attributes as attr, i (attr.id)}
							<div animate:flip={{ duration: 200 }}>
								{#if editingAttrId === attr.id && editingAttrEntityId === entity.id}

									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="flex items-center gap-1 rounded px-1.5 py-1"
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
											onclick={(e) => e.stopPropagation()}
											use:autofocus
											maxlength={100}
											class="min-w-0 flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-1.5 py-0.5 text-xs text-[var(--ui-text)] focus:ring-1 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
										/>
									</div>
								{:else}

									<div
										class="group flex items-center justify-between rounded px-2 py-0.5 text-xs cursor-grab"
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
											class="w-fit text-left text-[var(--ui-text-secondary)]"
											onclick={(e) => { e.stopPropagation(); void startAttrEdit(entity.id, attr.id, attr.name, attr.type); }}
											title="แก้ชื่อและประเภท Attribute"
											ondblclick={(e) => e.stopPropagation()}
										>
											{#if attr.type === 'primary_key'}
												<span class="mr-1 rounded bg-amber-500/10 px-1 text-[10px] font-medium text-amber-500">PK</span>
											{:else if attr.type === 'foreign_key'}
												<span class="mr-1 rounded bg-violet-500/10 px-1 text-[10px] font-medium text-violet-400">FK</span>
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


					{#if isSelected && diagram.selectedEntityId === entity.id && expandedEntities.has(entity.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
						<div class="mt-2 animate-slide-up" onclick={(e) => e.stopPropagation()}>
							<button class="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-left text-xs text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)]" aria-expanded={addingEntityId === entity.id} onclick={() => addingEntityId = addingEntityId === entity.id ? null : entity.id}><span>เพิ่ม Attribute</span><svg class="h-3.5 w-3.5 transition-transform {addingEntityId === entity.id ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" /></svg></button>
{#if addingEntityId === entity.id}<div class="mt-2"><AttributeForm entityId={entity.id} /></div>{/if}
						</div>


						<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->

					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
