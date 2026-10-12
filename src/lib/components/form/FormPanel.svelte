<script lang="ts">
	import ERStyleSwitcher from '$lib/components/ui/ERStyleSwitcher.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import NotationSwitcher from '$lib/components/ui/NotationSwitcher.svelte';
	import TextFormatSwitcher from '$lib/components/ui/TextFormatSwitcher.svelte';
	import ERPalette from './ERPalette.svelte';
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
	const TITLES: Record<string, { title: string; subtitle: string }> = {
		er: { title: 'ER Diagram Builder', subtitle: 'สร้าง Entity และ Relationship' },
		flowchart: { title: 'Flowchart Builder', subtitle: 'สร้าง Node และ Edge' },
		context: { title: 'Context Diagram', subtitle: 'สร้าง DFD Level 0' }
	};

	const headerInfo = $derived(TITLES[diagram.diagramType] ?? TITLES.er);


	const SNAP_POINTS = [0.14, 0.4, 0.66, 0.92];
	let snapIndex = $state(2);
	let dragStartY = $state(0);
	let dragDeltaY = $state(0);
	let dragging = $state(false);


	$effect(() => {
		if (mobileOpen) {
			snapIndex = 2;
			dragDeltaY = 0;
		}
	});

	const viewportH = $derived(typeof window !== 'undefined' ? window.innerHeight : 800);


	const sheetHeightPx = $derived(
		Math.max(
			56,
			Math.min(
				viewportH * SNAP_POINTS[SNAP_POINTS.length - 1],
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


		if (currentFrac < SNAP_POINTS[0] - 0.05) {
			onclose?.();
			dragDeltaY = 0;
			dragging = false;
			return;
		}

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
	{#each [...diagram.selectedNodeIds, ...(diagram.selectedEdgeId ? [diagram.selectedEdgeId] : [])] as id}
		{#if collab.lockLabel(id)}<p class="rounded-lg bg-amber-100 p-2 text-xs text-amber-800"> {collab.lockLabel(id)}</p>{/if}
	{/each}
	{#if diagram.diagramType === 'er'}
		<NotationSwitcher />
		<TextFormatSwitcher />
		<ERPalette />
		<ERStyleSwitcher />
		<EntityList {searchQuery} />
		<div class="border-t border-[var(--ui-border)]"></div>
		<RelationshipList {searchQuery} />

	{:else if diagram.diagramType === 'flowchart'}
		<TextFormatSwitcher />
		<FlowchartPanel />
	{:else if diagram.diagramType === 'context'}
		<TextFormatSwitcher />
		<ContextDiagramPanel />
		<ERStyleSwitcher label="รูปแบบ DFD" />
	{/if}
{/snippet}


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


			<div class="flex-1 overflow-y-auto">
				<div class="flex flex-col gap-5 p-4">
					{@render formContent()}
				</div>
			</div>
		</div>
	{/if}
</aside>


{#if mobileOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<aside
		class="mobile-panel fixed inset-x-0 bottom-0 z-30 flex w-full flex-col rounded-t-2xl border-t border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl lg:hidden"
		style="height: {sheetHeightPx}px; transition: {dragging ? 'none' : 'height 0.25s cubic-bezier(0.32,0.72,0,1)'};"
	>

		<div
			class="flex shrink-0 flex-col items-center gap-1.5 py-3 cursor-grab active:cursor-grabbing"
			style="touch-action:none;"
			ontouchstart={handleSwipeStart}
			ontouchmove={handleSwipeMove}
			ontouchend={handleSwipeEnd}
		>
			<div class="h-1.5 w-12 rounded-full bg-[var(--ui-text-muted)] opacity-40"></div>
		</div>

		<div class="flex shrink-0 items-center justify-between border-b border-[var(--ui-border)] px-4 pb-2">
			<div class="min-w-0">
				<h1 class="truncate text-base font-medium text-[var(--ui-text)]">{headerInfo.title}</h1>
				<p class="truncate text-xs text-[var(--ui-text-muted)]">{headerInfo.subtitle}</p>
			</div>
			<div class="flex shrink-0 items-center gap-1">

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


		<div class="min-h-0 flex-1 overflow-y-auto" style="touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;">
			<div class="flex flex-col gap-5 p-4 pb-24">
				{@render formContent()}
			</div>
		</div>
	</aside>
{/if}

<style>
 .text-format-dropdown > summary::-webkit-details-marker { display: none; }
	@keyframes panelFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.panel-content-fade {
		animation: panelFadeIn 0.2s ease-out;
	}
</style>
