<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { i18n } from '$lib/i18n';
	import NotationSwitcher from '$lib/components/ui/NotationSwitcher.svelte';
	import FontPicker from '$lib/components/ui/FontPicker.svelte';
	import EntityForm from './EntityForm.svelte';
	import EntityList from './EntityList.svelte';
	import RelationshipList from './RelationshipList.svelte';
	import FlowchartPanel from './FlowchartPanel.svelte';
	import ContextDiagramPanel from './ContextDiagramPanel.svelte';

	let {
		mobileOpen = false,
		onclose
	}: {
		mobileOpen?: boolean;
		onclose?: () => void;
	} = $props();

	let collapsed = $state(false);
	let searchQuery = '';
	let statsOpen = $state(false);

	const totalAttributes = $derived(
		diagram.entities.reduce((sum, e) => sum + e.attributes.length, 0)
	);
	const orphanCount = $derived(
		diagram.entities.filter(e => !diagram.relationships.some(r => r.entityIds.includes(e.id))).length
	);
	const missingPkCount = $derived(
		diagram.entities.filter(e => !e.attributes.some(a => a.type === 'primary_key')).length
	);

	const TITLES: Record<string, { title: string; subtitle: string }> = {
		er: { title: 'ER Diagram Builder', subtitle: 'สร้าง Entity และ Relationship' },
		flowchart: { title: 'Flowchart Builder', subtitle: 'สร้าง Node และ Edge' },
		context: { title: 'Context Diagram', subtitle: 'สร้าง DFD Level 0' }
	};

	const headerInfo = $derived(TITLES[diagram.diagramType] ?? TITLES.er);

	// Resizable snap sheet (Google-Maps-style): peek / half / full
	const SNAP_POINTS = [0.4, 0.66, 0.92]; // fraction of viewport height
	let snapIndex = $state(1); // start at "half"
	let dragStartY = $state(0);
	let dragDeltaY = $state(0); // >0 dragged down (smaller), <0 dragged up (taller)
	let dragging = $state(false);

	// Reset to the middle snap each time the sheet opens
	$effect(() => {
		if (mobileOpen) {
			snapIndex = 1;
			dragDeltaY = 0;
		}
	});

	const viewportH = $derived(typeof window !== 'undefined' ? window.innerHeight : 800);

	// Current sheet height in px, following the finger while dragging
	const sheetHeightPx = $derived(
		Math.max(
			80,
			Math.min(
				viewportH * SNAP_POINTS[2],
				viewportH * SNAP_POINTS[snapIndex] - dragDeltaY
			)
		)
	);

	function handleSwipeStart(e: TouchEvent) {
		dragStartY = e.touches[0].clientY;
		dragDeltaY = 0;
		dragging = true;
	}

	function handleSwipeMove(e: TouchEvent) {
		if (!dragging) return;
		dragDeltaY = e.touches[0].clientY - dragStartY;
	}

	function handleSwipeEnd() {
		const currentFrac = sheetHeightPx / viewportH;
		// Below the smallest snap by a margin → close entirely
		if (currentFrac < SNAP_POINTS[0] - 0.08) {
			onclose?.();
			dragDeltaY = 0;
			dragging = false;
			return;
		}
		// Snap to the nearest defined point
		let nearest = 0;
		let best = Infinity;
		for (let i = 0; i < SNAP_POINTS.length; i++) {
			const d = Math.abs(SNAP_POINTS[i] - currentFrac);
			if (d < best) { best = d; nearest = i; }
		}
		snapIndex = nearest;
		dragDeltaY = 0;
		dragging = false;
	}
</script>

{#snippet formContent()}
	{#if diagram.diagramType === 'er'}
		<NotationSwitcher />
		<FontPicker />
		<EntityForm />
		<EntityList {searchQuery} />
		<div class="border-t border-[var(--ui-border)]"></div>
		<RelationshipList {searchQuery} />

		{#if diagram.entities.length > 0}
			<div class="border-t border-[var(--ui-border)]"></div>
			<div class="flex flex-col gap-1.5">
				<button
					class="flex items-center gap-1 text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider hover:text-[var(--ui-text)] transition"
					onclick={() => statsOpen = !statsOpen}
				>
					<svg class="h-3 w-3 transition-transform {statsOpen ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					{i18n.t('stats.title')}
				</button>
				{#if statsOpen}
					<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--ui-text-secondary)] pl-4">
						<span>{i18n.t('stats.entities')}</span>
						<span class="font-medium text-[var(--ui-text)]">{diagram.entities.length}</span>
						<span>{i18n.t('stats.relationships')}</span>
						<span class="font-medium text-[var(--ui-text)]">{diagram.relationships.length}</span>
						<span>{i18n.t('stats.attributes')}</span>
						<span class="font-medium text-[var(--ui-text)]">{totalAttributes}</span>
						<span>{i18n.t('stats.orphans')}</span>
						<span class="font-medium {orphanCount > 0 ? 'text-orange-500' : 'text-[var(--ui-text)]'}">{orphanCount}</span>
						<span>{i18n.t('stats.missingPk')}</span>
						<span class="font-medium {missingPkCount > 0 ? 'text-red-500' : 'text-[var(--ui-text)]'}">{missingPkCount}</span>
					</div>
				{/if}
			</div>
		{/if}
	{:else if diagram.diagramType === 'flowchart'}
		<FontPicker />
		<FlowchartPanel />
	{:else if diagram.diagramType === 'context'}
		<FontPicker />
		<ContextDiagramPanel />
	{/if}
{/snippet}

<!-- Desktop: sidebar with smooth collapse transition -->
<aside
	data-onboarding="form-panel"
	class="hidden lg:flex h-full flex-col border-r border-[var(--ui-border)] bg-[var(--ui-bg)] sidebar-transition form-panel-content"
	style="width: {collapsed ? '48px' : ''}; min-width: {collapsed ? '48px' : ''};"
>
	{#if collapsed}
		<div class="flex flex-col items-center pt-3">
			<button
				class="rounded-lg p-2 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				onclick={() => collapsed = false}
				title="Show panel"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
			</button>
		</div>
	{:else}
		<div class="panel-content-fade flex flex-1 flex-col min-h-0">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
				<div class="min-w-0">
					<h1 class="text-lg font-medium text-[var(--ui-text)] truncate">{headerInfo.title}</h1>
					<p class="text-xs text-[var(--ui-text-muted)] truncate">{headerInfo.subtitle}</p>
				</div>
				<button
					class="rounded-lg p-1.5 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] shrink-0"
					onclick={() => collapsed = true}
					title="Hide panel"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
				</button>
			</div>

			<!-- Scrollable form area -->
			<div class="flex-1 overflow-y-auto">
				<div class="flex flex-col gap-5 p-4">
					{@render formContent()}
				</div>
			</div>
		</div>
	{/if}
</aside>

<!-- Mobile: bottom sheet (no backdrop — canvas behind stays interactive) -->
{#if mobileOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<aside
		class="mobile-panel fixed inset-x-0 bottom-0 z-30 flex w-full flex-col rounded-t-2xl border-t border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl lg:hidden"
		style="height: {sheetHeightPx}px; transition: {dragging ? 'none' : 'height 0.25s cubic-bezier(0.32,0.72,0,1)'};"
	>
		<!-- Drag handle — big touch target, drives snap resize -->
		<div
			class="flex shrink-0 flex-col items-center gap-1.5 py-3 cursor-grab active:cursor-grabbing"
			style="touch-action:none;"
			ontouchstart={handleSwipeStart}
			ontouchmove={handleSwipeMove}
			ontouchend={handleSwipeEnd}
		>
			<div class="h-1.5 w-12 rounded-full bg-[var(--ui-text-muted)] opacity-40"></div>
		</div>
		<!-- Header -->
		<div class="flex shrink-0 items-center justify-between border-b border-[var(--ui-border)] px-4 pb-2">
			<div class="min-w-0">
				<h1 class="truncate text-base font-medium text-[var(--ui-text)]">{headerInfo.title}</h1>
				<p class="truncate text-xs text-[var(--ui-text-muted)]">{headerInfo.subtitle}</p>
			</div>
			<div class="flex shrink-0 items-center gap-1">
				<!-- Snap position dots -->
				<div class="mr-1 flex items-center gap-1">
					{#each SNAP_POINTS as _, i}
						<button
							class="h-1.5 w-1.5 rounded-full transition-all {i === snapIndex ? 'bg-[var(--ui-accent)] w-3' : 'bg-[var(--ui-text-muted)] opacity-40'}"
							style="padding:0;min-width:0;min-height:0;"
							aria-label="Snap size {i + 1}"
							onclick={() => { snapIndex = i; dragDeltaY = 0; }}
						></button>
					{/each}
				</div>
				<button
					style="padding:0;min-width:0;min-height:0;"
					class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
					onclick={onclose}
					title="Close panel"
					aria-label="Close panel"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>
		</div>

		<!-- Scrollable form area -->
		<div class="min-h-0 flex-1 overflow-y-auto" style="touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;">
			<div class="flex flex-col gap-5 p-4 pb-24">
				{@render formContent()}
			</div>
		</div>
	</aside>
{/if}

<style>
	@keyframes panelFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.panel-content-fade {
		animation: panelFadeIn 0.2s ease-out;
	}
</style>
