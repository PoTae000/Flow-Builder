<script lang="ts">
	import { session } from '$lib/stores/session.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import UserMenu from './UserMenu.svelte';
	import SyncIndicator from './SyncIndicator.svelte';

	let { onnewdiagram }: { onnewdiagram?: () => void } = $props();

	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editInput = $state<HTMLInputElement | null>(null);

	function startRename(id: string, currentName: string) {
		editingId = id;
		editName = currentName;
		// Focus the input after it renders
		requestAnimationFrame(() => editInput?.select());
	}

	function commitRename() {
		if (editingId) {
			session.renameDiagram(editingId, editName);
			editingId = null;
		}
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			commitRename();
		} else if (e.key === 'Escape') {
			editingId = null;
		}
	}

	async function handleDelete(id: string, name: string) {
		const isLast = session.diagrams.length <= 1;
		const confirmed = await dialog.confirm({
			title: 'ลบ Diagram',
			message: isLast
				? `ต้องการลบ "${name}" หรือไม่? เนื้อหาจะถูกล้างและเริ่ม Diagram ใหม่`
				: `ต้องการลบ "${name}" หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
			confirmText: 'ลบ',
			cancelText: 'ยกเลิก',
			variant: 'danger'
		});
		if (confirmed) {
			session.deleteDiagram(id);
		}
	}

	function handleDuplicate(id: string) {
		session.duplicateDiagram(id);
	}

	// Scroll indicator
	let tabsContainer: HTMLDivElement | undefined = $state();
	let scrollLeft = $state(0);
	let scrollWidth = $state(0);
	let clientWidth = $state(0);

	const canScrollLeft = $derived(scrollLeft > 2);
	const canScrollRight = $derived(scrollLeft + clientWidth < scrollWidth - 2);

	function handleTabsScroll() {
		if (!tabsContainer) return;
		scrollLeft = tabsContainer.scrollLeft;
		scrollWidth = tabsContainer.scrollWidth;
		clientWidth = tabsContainer.clientWidth;
	}

	// Auto-scroll to active tab when it changes
	$effect(() => {
		const activeId = session.activeDiagramId;
		if (!activeId || !tabsContainer) return;
		requestAnimationFrame(() => {
			const activeEl = tabsContainer?.querySelector(`[data-tab-id="${activeId}"]`);
			if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		});
	});
</script>

<style>
	.tabs-scroll::-webkit-scrollbar { display: none; }
	.tabs-scroll { scrollbar-width: none; }
	@keyframes tabActivate {
		from { opacity: 0.6; transform: translateY(1px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.tab-active-anim {
		animation: tabActivate 0.15s ease-out;
	}
</style>

<div class="flex h-11 items-center border-b border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)]">
	<!-- Tabs -->
	<div class="tabs-scroll relative flex min-w-0 flex-1 items-center gap-0 overflow-x-auto px-1" bind:this={tabsContainer} onscroll={handleTabsScroll}>
		{#if canScrollLeft}
			<div class="pointer-events-none absolute left-0 top-0 z-10 h-full w-6 bg-gradient-to-r from-[var(--ui-bg-secondary)] to-transparent"></div>
		{/if}
		{#if canScrollRight}
			<div class="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-[var(--ui-bg-secondary)] to-transparent"></div>
		{/if}
		{#each session.diagrams as tab (tab.id)}
			{@const isActive = tab.id === session.activeDiagramId}
			<div
				data-tab-id={tab.id}
				class="group flex h-7 min-w-16 max-w-48 shrink items-center rounded-t transition-all duration-200 {isActive
					? 'bg-[var(--ui-bg)] border-x border-t border-[var(--ui-border-light)] shadow-sm'
					: 'hover:bg-[var(--ui-hover)]'} cursor-pointer"
			>
				{#if editingId === tab.id}
					<input
						bind:this={editInput}
						bind:value={editName}
						class="mx-1 w-24 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-1 text-xs text-[var(--ui-text)] outline-none"
						onblur={commitRename}
						onkeydown={handleRenameKeydown}
					/>
				{:else}
					<button
						type="button"
						class="min-w-0 flex-1 truncate border-none bg-transparent px-2.5 text-xs transition-colors duration-200 {isActive
							? 'text-[var(--ui-text)] font-normal tab-active-anim'
							: 'text-[var(--ui-text-muted)] font-light'} cursor-pointer outline-none"
						onclick={() => { if (!collab.connected) session.switchDiagram(tab.id); }}
						ondblclick={() => { if (!collab.connected) startRename(tab.id, tab.name); }}
					>
						{tab.name}
					</button>
				{/if}

				{#if !collab.connected}
					<button
						style="padding:0;min-width:0;min-height:0;"
						class="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-tertiary)] hover:text-[var(--ui-text)]"
						aria-label="Delete diagram"
						onclick={(e) => {
							e.stopPropagation();
							handleDelete(tab.id, tab.name);
						}}
						ontouchend={(e) => {
							e.stopPropagation();
							e.preventDefault();
							handleDelete(tab.id, tab.name);
						}}
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
					</button>
				{/if}
			</div>
		{/each}

		<!-- New tab button (hidden during collab) -->
		{#if !collab.connected}
			<button
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				aria-label="New diagram"
				onclick={() => onnewdiagram?.()}
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v16m8-8H4" /></svg>
			</button>
		{/if}
	</div>

	<!-- Sync indicator + User menu (right side) -->
	<div class="flex shrink-0 items-center gap-2 pr-4 pl-2">
		<SyncIndicator />
		<UserMenu />
	</div>
</div>
