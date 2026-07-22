<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { sync } from '$lib/stores/sync.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { VersionMeta, DiagramData } from '$lib/types/session';

	let { onclose }: { onclose: () => void } = $props();

	// Tab state
	let activeTab = $state<'local' | 'cloud'>('local');

	// Local history
	const entries = $derived(diagram.historyEntries);
	let previewIndex = $state(-1);

	// Cloud history
	let cloudVersions = $state<VersionMeta[]>([]);
	let cloudLoading = $state(false);
	let cloudPreviewId = $state<number | null>(null);

	function handlePreview(index: number) {
		previewIndex = index;
		diagram.previewHistoryEntry(index);
	}

	function handleApply() {
		diagram.exitPreview(true);
		previewIndex = -1;
		session.saveNow();
		onclose();
	}

	function handleCancel() {
		diagram.exitPreview(false);
		previewIndex = -1;
	}

	function handleClose() {
		if (diagram.timelinePreviewActive) {
			diagram.exitPreview(false);
		}
		previewIndex = -1;
		cloudPreviewId = null;
		onclose();
	}

	// Cloud tab
	async function loadCloudVersions() {
		if (!session.activeDiagramId || !sync.canSync) return;
		cloudLoading = true;
		cloudVersions = await sync.fetchVersions(session.activeDiagramId);
		cloudLoading = false;
	}

	async function handleCloudPreview(version: VersionMeta) {
		if (!session.activeDiagramId) return;
		cloudPreviewId = version.id;
		const data = await sync.fetchVersionData(session.activeDiagramId, version.id);
		if (data) {
			diagram.previewData(data);
		}
	}

	async function handleCloudRestore(version: VersionMeta) {
		if (!session.activeDiagramId) return;
		const result = await sync.restoreVersion(session.activeDiagramId, version.id);
		if (result) {
			diagram.exitPreview(false);
			diagram.loadData(result.data);
			session.renameDiagram(session.activeDiagramId, result.name);
			session.saveNow();
			toast.success('Restored to version: ' + formatTime(version.createdAt));
			cloudPreviewId = null;
			onclose();
		} else {
			toast.error('Failed to restore version');
		}
	}

	function handleCloudCancel() {
		if (diagram.timelinePreviewActive) {
			diagram.exitPreview(false);
		}
		cloudPreviewId = null;
	}

	function switchTab(tab: 'local' | 'cloud') {
		// Cancel any active preview when switching tabs
		if (diagram.timelinePreviewActive) {
			diagram.exitPreview(false);
		}
		previewIndex = -1;
		cloudPreviewId = null;
		activeTab = tab;
		if (tab === 'cloud') {
			loadCloudVersions();
		}
	}

	function formatTime(ts: number): string {
		const diff = Date.now() - ts;
		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) return 'just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		return new Date(ts).toLocaleDateString();
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 animate-fade-in" onclick={handleClose} onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }}></div>

<!-- Panel -->
<div class="fixed z-50 max-h-[80vh] overflow-y-auto border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-xl animate-scale-in inset-x-0 bottom-0 w-full rounded-t-2xl md:inset-x-auto md:bottom-auto md:top-26 md:right-3 md:w-80 md:rounded-lg">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			<span class="text-sm font-medium text-[var(--ui-text)]">
				{#if diagram.timelinePreviewActive}
					Previewing...
				{:else}
					History
				{/if}
			</span>
		</div>
		<button
			class="rounded p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			onclick={handleClose}
			aria-label="Close"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<!-- Tabs -->
	<div class="flex border-b border-[var(--ui-border)]">
		<button
			class="flex-1 px-4 py-2 text-xs font-medium transition {activeTab === 'local' ? 'text-[var(--ui-accent)] border-b-2 border-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'}"
			onclick={() => switchTab('local')}
		>
			Local
		</button>
		<button
			class="flex-1 px-4 py-2 text-xs font-medium transition {activeTab === 'cloud' ? 'text-[var(--ui-accent)] border-b-2 border-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'}"
			onclick={() => switchTab('cloud')}
			disabled={!auth.isSignedIn}
			title={!auth.isSignedIn ? 'Sign in to use cloud history' : ''}
		>
			Cloud
			{#if !auth.isSignedIn}
				<svg class="ml-1 inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
			{/if}
		</button>
	</div>

	<div class="p-4">
		{#if activeTab === 'local'}
			<!-- Local History Tab -->
			{#if entries.length === 0}
				<div class="py-8 text-center text-xs text-[var(--ui-text-muted)]">
					No history yet
				</div>
			{:else}
				{#if diagram.timelinePreviewActive && cloudPreviewId === null}
					<div class="mb-3 flex items-center gap-2">
						<button
							class="flex-1 rounded bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition"
							onclick={handleApply}
						>
							Apply
						</button>
						<button
							class="flex-1 rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs font-medium text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition"
							onclick={handleCancel}
						>
							Cancel
						</button>
					</div>
				{/if}

				<button
					class="mb-3 flex w-full items-center gap-2 rounded px-3 py-2 transition {previewIndex === -1 ? 'bg-green-500/10 ring-1 ring-green-500/30' : 'bg-[var(--ui-bg-secondary)] hover:bg-[var(--ui-hover)]'}"
					onclick={handleCancel}
					disabled={!diagram.timelinePreviewActive}
				>
					<span class="h-2 w-2 rounded-full bg-green-500"></span>
					<span class="text-xs font-medium text-[var(--ui-text)]">Current</span>
				</button>

				<div class="space-y-1">
					{#each entries.toReversed() as entry, reversedIdx}
						{@const originalIndex = entries.length - 1 - reversedIdx}
						<button
							class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs transition {previewIndex === originalIndex ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'hover:bg-[var(--ui-hover)]'}"
							onclick={() => handlePreview(originalIndex)}
						>
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--ui-bg-secondary)] text-[10px] font-mono text-[var(--ui-text-muted)]">
								{originalIndex + 1}
							</span>
							<span class="flex-1 truncate text-[var(--ui-text-secondary)]">{entry}</span>
							<svg class="h-3 w-3 shrink-0 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" /></svg>
						</button>
					{/each}
				</div>
			{/if}

		{:else}
			<!-- Cloud History Tab -->
			{#if cloudLoading}
				<div class="flex items-center justify-center py-8">
					<svg class="h-5 w-5 animate-spin text-[var(--ui-text-muted)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
				</div>
			{:else if cloudVersions.length === 0}
				<div class="py-8 text-center text-xs text-[var(--ui-text-muted)]">
					No cloud versions yet.<br/>
					<span class="text-[10px]">Versions are saved automatically when you sync.</span>
				</div>
			{:else}
				<!-- Apply/Cancel for cloud preview -->
				{#if cloudPreviewId !== null}
					<div class="mb-3 flex items-center gap-2">
						<button
							class="flex-1 rounded bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition"
							onclick={() => {
								const v = cloudVersions.find(v => v.id === cloudPreviewId);
								if (v) handleCloudRestore(v);
							}}
						>
							Restore
						</button>
						<button
							class="flex-1 rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs font-medium text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition"
							onclick={handleCloudCancel}
						>
							Cancel
						</button>
					</div>
				{/if}

				<div class="space-y-1">
					{#each cloudVersions as version}
						<button
							class="flex w-full items-center gap-2 rounded px-3 py-2 text-left transition {cloudPreviewId === version.id ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'hover:bg-[var(--ui-hover)]'}"
							onclick={() => handleCloudPreview(version)}
						>
							<div class="flex-1 min-w-0">
								<div class="text-xs font-medium text-[var(--ui-text)] truncate">{version.name || 'Untitled'}</div>
								<div class="text-[10px] text-[var(--ui-text-muted)]">{formatTime(version.createdAt)}</div>
							</div>
							<svg class="h-3 w-3 shrink-0 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
						</button>
					{/each}
				</div>

				<!-- Refresh button -->
				<button
					class="mt-3 flex w-full items-center justify-center gap-1 rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] transition"
					onclick={loadCloudVersions}
				>
					<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
					Refresh
				</button>
			{/if}
		{/if}
	</div>
</div>
