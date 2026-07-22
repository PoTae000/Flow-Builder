<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { i18n } from '$lib/i18n';
	import { ui } from '$lib/stores/ui.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import AutoSaveIndicator from './AutoSaveIndicator.svelte';

	let {
		onexport,
		onimport,
		onanalyze,
		ontranslate,
		ongenerate,
		onchat,
		onpresent,
		oncollab,
		onhistory,
		ontemplates,
		onaddrelationship,
		onaddnote,
		ondatadict,
		ondomainstarter,
		onfitcontent,
		onmatrix,
		onsqlquery,
		onquiz,
		ontutorial
	}: {
		onexport: () => void;
		onimport: () => void;
		onanalyze: () => void;
		ontranslate: () => void;
		ongenerate: () => void;
		onchat: () => void;
		onpresent: () => void;
		oncollab: () => void;
		onhistory?: () => void;
		ontemplates?: () => void;
		onaddrelationship?: () => void;
		onaddnote?: () => void;
		ondatadict?: () => void;
		ondomainstarter?: () => void;
		onfitcontent?: () => void;
		onmatrix?: () => void;
		onsqlquery?: () => void;
		onquiz?: () => void;
		ontutorial?: () => void;
	} = $props();

	function zoomIn() {
		diagram.smoothTransition = true;
		diagram.setZoom(diagram.zoom * 1.2);
		setTimeout(() => { diagram.smoothTransition = false; }, 300);
	}

	function zoomOut() {
		diagram.smoothTransition = true;
		diagram.setZoom(diagram.zoom / 1.2);
		setTimeout(() => { diagram.smoothTransition = false; }, 300);
	}

	function resetView() {
		diagram.smoothResetView();
	}

	let showOverflow = $state(false);
	let showDesktopOverflow = $state(false);

	async function autoLayout() {
		if (collab.connected && collab.users.length > 1) {
			const granted = await collab.requestPermission('auto-layout');
			if (!granted) return;
		}
		diagram.animateLayout(300);
	}

	const zoomPercent = $derived(Math.round(diagram.zoom * 100));
	const btnClass = "rounded px-2 py-1.5 text-xs font-light text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90 touch-manipulation";
	const btnWithLabelClass = "flex items-center gap-1 rounded px-2 py-1.5 text-xs font-light text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-95 touch-manipulation";
	const overflowBtnClass = "flex w-full items-center gap-2 rounded px-3 py-2 text-xs font-light text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] touch-manipulation";
</script>

<!-- Wrapper for positioning dropdowns -->
<div class="relative">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	{#if showOverflow || showDesktopOverflow}
		<div class="fixed inset-0 z-40" onclick={() => { showOverflow = false; showDesktopOverflow = false; }} onkeydown={(e) => { if (e.key === 'Escape') { showOverflow = false; showDesktopOverflow = false; } }}></div>
	{/if}

	<div class="flex items-center gap-1 rounded-lg bg-[var(--ui-bg-secondary)] border border-[var(--ui-border)] p-1 shadow-sm overflow-x-auto max-w-full">
	<!-- Theme toggle -->
	<button
		class={btnClass}
		onclick={() => theme.toggle()}
		title={i18n.t(theme.isDark ? 'toolbar.lightMode' : 'toolbar.darkMode')}
		aria-label={i18n.t(theme.isDark ? 'toolbar.lightMode' : 'toolbar.darkMode')}
	>
		{#key theme.isDark}
			{#if theme.isDark}
				<svg class="h-4 w-4 theme-icon-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
			{:else}
				<svg class="h-4 w-4 theme-icon-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
			{/if}
		{/key}
	</button>

	<!-- Zoom controls -->
	<button class={btnClass} onclick={zoomOut} title={i18n.t('toolbar.zoomOut')} aria-label={i18n.t('toolbar.zoomOut')}>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" /></svg>
	</button>
	<span class="min-w-[3rem] text-center text-xs font-light text-[var(--ui-text-muted)]">{zoomPercent}%</span>
	<button class={btnClass} onclick={zoomIn} title={i18n.t('toolbar.zoomIn')} aria-label={i18n.t('toolbar.zoomIn')}>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
	</button>

	<div class="mx-1 h-4 w-px bg-[var(--ui-border)]"></div>

	<!-- Undo/Redo -->
	<button class={btnClass} onclick={() => diagram.undo()} disabled={!diagram.canUndo} title={i18n.t('toolbar.undo')} aria-label={i18n.t('toolbar.undo')}>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" /></svg>
	</button>
	<button class={btnClass} onclick={() => diagram.redo()} disabled={!diagram.canRedo} title={i18n.t('toolbar.redo')} aria-label={i18n.t('toolbar.redo')}>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" /></svg>
	</button>

	<div class="mx-1 h-4 w-px bg-[var(--ui-border)]"></div>

	<!-- Auto-save indicator -->
	<AutoSaveIndicator />

	<!-- Offline indicator -->
	{#if !ui.isOnline}
		<div class="flex items-center gap-1 rounded px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 4h.01" /></svg>
			<span class="text-[10px] font-medium">Offline</span>
			{#if ui.offlineQueueCount > 0}
				<span class="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{ui.offlineQueueCount}</span>
			{/if}
		</div>
	{/if}

	<!-- Desktop primary buttons (always visible on 2xl) -->
	<div class="hidden 2xl:contents">
		{#if diagram.diagramType === 'er'}
			<div class="mx-1 h-4 w-px bg-[var(--ui-border)]"></div>

			<!-- Add Relationship (important, always visible) -->
			<button data-onboarding="add-rel" class={btnWithLabelClass} onclick={onaddrelationship} title={i18n.t('toolbar.addRelationship')} aria-label={i18n.t('toolbar.addRelationship')}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
				{i18n.t('toolbar.addRelationship')}
			</button>
		{/if}

		<div class="mx-1 h-4 w-px bg-[var(--ui-border)]"></div>

		<!-- AI features group (hidden for guests) -->
		{#if auth.isSignedIn}
			{#if diagram.diagramType !== 'context'}
				<button class={btnWithLabelClass} onclick={onanalyze} title={i18n.t('toolbar.analyze')} aria-label={i18n.t('toolbar.analyze')}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
					{i18n.t('toolbar.ai')}
				</button>
			{/if}

			<button class={btnWithLabelClass} onclick={ontranslate} title={i18n.t('toolbar.translate')} aria-label={i18n.t('toolbar.translateShort')}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
				{i18n.t('toolbar.translateShort')}
			</button>

			<button class={btnWithLabelClass} onclick={onchat} title={i18n.t('toolbar.aiChat')} aria-label={i18n.t('toolbar.aiChat')}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
				{i18n.t('toolbar.chat')}
			</button>
		{/if}

		<div class="mx-1 h-4 w-px bg-[var(--ui-border)]"></div>

		<!-- Collaboration -->
		<button class="relative {btnWithLabelClass}" onclick={oncollab} title={i18n.t('toolbar.collaboration')} aria-label={i18n.t('toolbar.collaboration')}>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
			{i18n.t('toolbar.collab')}
			{#if collab.connected && collab.users.length > 0}
				<span class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">{collab.users.length}</span>
			{/if}
		</button>

		<!-- Focus Mode Toggle (ER only) -->
		{#if diagram.diagramType === 'er'}
			<button
				class="{btnClass} {diagram.focusMode ? '!bg-purple-100 !text-purple-600 dark:!bg-purple-900/30 dark:!text-purple-400' : ''}"
				onclick={() => diagram.focusMode = !diagram.focusMode}
				title="Focus Mode"
				aria-label="Focus Mode"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
			</button>
		{/if}

		<!-- Data Flow Toggle -->
		<button
			class="{btnClass} {diagram.showDataFlow ? '!bg-cyan-100 !text-cyan-600 dark:!bg-cyan-900/30 dark:!text-cyan-400' : ''}"
			onclick={() => diagram.toggleDataFlow()}
			title="Data Flow"
			aria-label="Data Flow"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
		</button>

		<!-- Grid Toggle -->
		<button
			class="{btnClass} {diagram.showGrid ? '!bg-blue-100 !text-blue-600 dark:!bg-blue-900/30 dark:!text-blue-400' : ''}"
			onclick={() => diagram.toggleGrid()}
			title={i18n.t('toolbar.grid')}
			aria-label={i18n.t('toolbar.grid')}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v16h16M4 12h16M12 4v16M8 4v16M16 4v16M4 8h16M4 16h16" /></svg>
		</button>

		<!-- Physics Toggle -->
		<button
			class="{btnClass} {diagram.physicsMode ? '!bg-green-100 !text-green-600 dark:!bg-green-900/30 dark:!text-green-400' : ''}"
			onclick={() => diagram.togglePhysics()}
			title="Physics Simulation"
			aria-label="Physics Simulation"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
		</button>

		<div class="mx-1 h-4 w-px bg-[var(--ui-border)]"></div>

		<!-- Desktop overflow "..." button -->
		<button
			class={btnClass}
			onclick={() => {
				showDesktopOverflow = !showDesktopOverflow;
			}}
			title={i18n.t('toolbar.more')}
			aria-label={i18n.t('toolbar.more')}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
		</button>
	</div>

	<!-- Desktop overflow dropdown -->
	{#if showDesktopOverflow}
		<div class="absolute top-full right-0 z-50 mt-1 w-48 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-1 shadow-lg animate-slide-up">
			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; onimport(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
				{i18n.t('toolbar.import')}
			</button>
			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; onexport(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
				{i18n.t('toolbar.export')}
			</button>
			{#if auth.isSignedIn}
				<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; ongenerate(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
					{i18n.t('toolbar.generateCode')}
				</button>
			{/if}

			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			{#if diagram.diagramType === 'er'}
				<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; onaddnote?.(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
					{i18n.t('toolbar.addNote')}
				</button>
			{/if}

			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; ondatadict?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
				{#if diagram.diagramType === 'flowchart'}
					Node List
				{:else if diagram.diagramType === 'context'}
					Flow Dictionary
				{:else}
					{i18n.t('toolbar.dataDict')}
				{/if}
			</button>
			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; onmatrix?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
				{#if diagram.diagramType === 'flowchart'}
					Connection Matrix
				{:else if diagram.diagramType === 'context'}
					Flow Matrix
				{:else}
					{i18n.t('toolbar.matrix')}
				{/if}
			</button>

			{#if diagram.diagramType === 'er'}
				<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; onsqlquery?.(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
					{i18n.t('toolbar.sqlQuery')}
				</button>
			{/if}
			{#if auth.isSignedIn && diagram.diagramType !== 'context'}
				<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; onquiz?.(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
					{i18n.t('toolbar.quiz')}
				</button>
			{/if}

			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; resetView(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
				{i18n.t('toolbar.resetView')}
			</button>
			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; onfitcontent?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" /></svg>
				{i18n.t('toolbar.fitContent')}
			</button>
			<button
				class={overflowBtnClass}
				onclick={() => { showDesktopOverflow = false; autoLayout(); }}
				disabled={diagram.entities.length === 0 && diagram.flowNodes.length === 0 && diagram.dfdNodes.length === 0}
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
				{i18n.t('toolbar.layout')}
			</button>

			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; onpresent(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16l13-8z" /></svg>
				{i18n.t('toolbar.present')}
			</button>
			{#if diagram.diagramType !== 'context'}
				<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; ontemplates?.(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
					{i18n.t('toolbar.templates')}
				</button>
				{#if auth.isSignedIn}
					<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; ondomainstarter?.(); }}>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
						{i18n.t('toolbar.domainStarter')}
					</button>
				{/if}
			{/if}
			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; onhistory?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				{i18n.t('toolbar.history')}
			</button>
			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; ontutorial?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				{i18n.t('toolbar.tutorial')}
			</button>

			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			<button class={overflowBtnClass} onclick={() => { showDesktopOverflow = false; i18n.toggle(); }}>
				<span class="flex h-4 w-4 items-center justify-center text-xs font-bold">{i18n.isEn ? 'EN' : 'TH'}</span>
				{i18n.t('common.langToggle')}
			</button>
		</div>
	{/if}

	<!-- Mobile overflow menu button -->
	<div class="2xl:hidden">
		<div class="mx-1 h-4 w-px bg-[var(--ui-border)]"></div>
	</div>
	<button
		class="2xl:hidden {btnClass}"
		onclick={() => {
			showOverflow = !showOverflow;
		}}
		title={i18n.t('toolbar.more')}
		aria-label={i18n.t('toolbar.more')}
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
	</button>

	<!-- Mobile overflow dropdown -->
	{#if showOverflow}
		<div class="absolute top-full right-0 z-50 mt-1 w-48 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-1 shadow-lg max-h-[70vh] overflow-y-auto animate-slide-up">
			<button class={overflowBtnClass} onclick={() => { showOverflow = false; onimport(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
				{i18n.t('toolbar.import')}
			</button>
			<button class={overflowBtnClass} onclick={() => { showOverflow = false; onexport(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
				{i18n.t('toolbar.export')}
			</button>

			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			{#if diagram.diagramType === 'er'}
				<button class={overflowBtnClass} onclick={() => { showOverflow = false; onaddrelationship?.(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
					{i18n.t('toolbar.addRelationship')}
				</button>
			{/if}
			<button class={overflowBtnClass} onclick={() => { showOverflow = false; onaddnote?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
				{i18n.t('toolbar.addNote')}
			</button>

			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			<button class={overflowBtnClass} onclick={resetView} aria-label={i18n.t('toolbar.resetView')}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
				{i18n.t('toolbar.resetView')}
			</button>
			<button class={overflowBtnClass} onclick={() => { showOverflow = false; onfitcontent?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" /></svg>
				{i18n.t('toolbar.fitContent')}
			</button>
			<button
				class={overflowBtnClass}
				onclick={() => { showOverflow = false; autoLayout(); }}
				disabled={diagram.entities.length === 0 && diagram.flowNodes.length === 0 && diagram.dfdNodes.length === 0}
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
				{i18n.t('toolbar.layout')}
			</button>

			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			{#if auth.isSignedIn}
				{#if diagram.diagramType !== 'context'}
					<button class={overflowBtnClass} onclick={() => { showOverflow = false; onanalyze(); }}>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
						{i18n.t('toolbar.aiAnalyze')}
					</button>
				{/if}
				<button class={overflowBtnClass} onclick={() => { showOverflow = false; ontranslate(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
					{i18n.t('toolbar.translateShort')}
				</button>
				{#if diagram.diagramType !== 'context'}
					<button class={overflowBtnClass} onclick={() => { showOverflow = false; ongenerate(); }}>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
						{i18n.t('toolbar.generateCode')}
					</button>
				{/if}
				<button class={overflowBtnClass} onclick={() => { showOverflow = false; onchat(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
					{i18n.t('toolbar.aiChat')}
				</button>
			{/if}
			<button class={overflowBtnClass} onclick={() => { showOverflow = false; ondatadict?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
				{#if diagram.diagramType === 'flowchart'}
					Node List
				{:else if diagram.diagramType === 'context'}
					Flow Dictionary
				{:else}
					{i18n.t('toolbar.dataDict')}
				{/if}
			</button>
			<button class={overflowBtnClass} onclick={() => { showOverflow = false; onmatrix?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
				{#if diagram.diagramType === 'flowchart'}
					Connection Matrix
				{:else if diagram.diagramType === 'context'}
					Flow Matrix
				{:else}
					{i18n.t('toolbar.matrix')}
				{/if}
			</button>

			{#if diagram.diagramType === 'er'}
				<button class={overflowBtnClass} onclick={() => { showOverflow = false; onsqlquery?.(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
					{i18n.t('toolbar.sqlQuery')}
				</button>
			{/if}
			{#if auth.isSignedIn && diagram.diagramType !== 'context'}
				<button class={overflowBtnClass} onclick={() => { showOverflow = false; onquiz?.(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
					{i18n.t('toolbar.quiz')}
				</button>
			{/if}

			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			<button class="relative {overflowBtnClass}" onclick={() => { showOverflow = false; oncollab(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
				{i18n.t('toolbar.collab')}
				{#if collab.connected && collab.users.length > 0}
					<span class="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">{collab.users.length}</span>
				{/if}
			</button>
			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			<button class={overflowBtnClass} onclick={() => { showOverflow = false; diagram.toggleGrid(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v16h16M4 12h16M12 4v16M8 4v16M16 4v16M4 8h16M4 16h16" /></svg>
				{i18n.t('toolbar.grid')} {diagram.showGrid ? '(ON)' : ''}
			</button>
			<button class={overflowBtnClass} onclick={() => { showOverflow = false; diagram.togglePhysics(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
				Physics {diagram.physicsMode ? '(ON)' : ''}
			</button>
			<button class={overflowBtnClass} onclick={() => { showOverflow = false; diagram.toggleDataFlow(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
				Data Flow {diagram.showDataFlow ? '(ON)' : ''}
			</button>
			{#if diagram.diagramType !== 'context'}
				<button class={overflowBtnClass} onclick={() => { showOverflow = false; ontemplates?.(); }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
					{i18n.t('toolbar.templates')}
				</button>
				{#if auth.isSignedIn}
					<button class={overflowBtnClass} onclick={() => { showOverflow = false; ondomainstarter?.(); }}>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
						{i18n.t('toolbar.domainStarter')}
					</button>
				{/if}
			{/if}
			<button class={overflowBtnClass} onclick={() => { showOverflow = false; onhistory?.(); }}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				{i18n.t('toolbar.history')}
			</button>
			<div class="my-1 h-px bg-[var(--ui-border)]"></div>

			<button class={overflowBtnClass} onclick={() => { showOverflow = false; i18n.toggle(); }}>
				<span class="flex h-4 w-4 items-center justify-center text-xs font-bold">{i18n.isEn ? 'EN' : 'TH'}</span>
				{i18n.t('common.langToggle')}
			</button>
		</div>
	{/if}
	</div>
</div>

<style>
	@keyframes themeIconSpin {
		from { opacity: 0; transform: rotate(-90deg) scale(0.5); }
		to { opacity: 1; transform: rotate(0) scale(1); }
	}
	:global(.theme-icon-spin) {
		animation: themeIconSpin 0.3s ease-out;
	}
</style>
