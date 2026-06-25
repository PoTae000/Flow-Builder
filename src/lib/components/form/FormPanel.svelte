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

	// Swipe-to-close
	let swipeStartY = $state(0);
	let swipeDeltaY = $state(0);
	let swiping = $state(false);

	function handleSwipeStart(e: TouchEvent) {
		swipeStartY = e.touches[0].clientY;
		swipeDeltaY = 0;
		swiping = true;
	}

	function handleSwipeMove(e: TouchEvent) {
		if (!swiping) return;
		const dy = e.touches[0].clientY - swipeStartY;
		swipeDeltaY = Math.max(0, dy);
	}

	function handleSwipeEnd() {
		if (swipeDeltaY > 150) {
			onclose?.();
		}
		swipeDeltaY = 0;
		swiping = false;
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

<!-- Mobile: bottom sheet overlay -->
{#if mobileOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-20 bg-black/30 lg:hidden" onclick={onclose} onkeydown={(e) => { if (e.key === 'Escape') onclose?.(); }}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<aside
		class="mobile-panel fixed inset-x-0 bottom-0 z-30 flex max-h-[70vh] w-full flex-col rounded-t-2xl border-t border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl lg:hidden"
		style="transform: translateY({swipeDeltaY}px); opacity: {Math.max(0.3, 1 - swipeDeltaY / 200)}; transition: {swiping ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out'};"
	>
		<!-- Drag handle -->
		<div
			class="flex justify-center py-2 cursor-grab"
			ontouchstart={handleSwipeStart}
			ontouchmove={handleSwipeMove}
			ontouchend={handleSwipeEnd}
		>
			<div class="h-1 w-10 rounded-full bg-[var(--ui-border)]"></div>
		</div>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-2">
			<div>
				<h1 class="text-base font-medium text-[var(--ui-text)]">{headerInfo.title}</h1>
				<p class="text-xs text-[var(--ui-text-muted)]">{headerInfo.subtitle}</p>
			</div>
			<button
				class="rounded-lg p-1.5 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				onclick={onclose}
				title="Close panel"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
			</button>
		</div>

		<!-- Scrollable form area -->
		<div class="flex-1 overflow-y-auto">
			<div class="flex flex-col gap-5 p-4">
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
