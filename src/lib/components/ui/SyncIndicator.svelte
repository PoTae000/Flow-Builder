<script lang="ts">
	import { sync } from '$lib/stores/sync.svelte';
	import { auth } from '$lib/stores/auth.svelte';

	// dirty = there are local edits not yet pushed to the cloud.
	const dirty = $derived(sync.hasPendingPush);
	const syncing = $derived(sync.status === 'syncing');
	const paused = $derived(sync.isPaused);

	function handleSyncNow() {
		sync.syncNow();
	}

	// Pick button colour + label from state.
	const state = $derived(
		paused ? 'error' : syncing ? 'syncing' : dirty ? 'dirty' : 'clean'
	);

	const label = $derived(
		state === 'error' ? 'ลองใหม่'
		: state === 'syncing' ? 'กำลัง Sync'
		: state === 'dirty' ? 'Sync'
		: 'Synced'
	);
</script>

{#if auth.isSignedIn}
	<button
		onclick={handleSyncNow}
		disabled={syncing}
		style="padding:0 10px 0 8px;min-height:0;height:28px;"
		class="flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors disabled:cursor-default
			{state === 'error'
				? 'bg-orange-500 text-white hover:bg-orange-600'
				: state === 'syncing'
					? 'bg-[var(--ui-hover)] text-[var(--ui-text-muted)]'
					: state === 'dirty'
						? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95'
						: 'bg-[var(--ui-hover)] text-[var(--ui-text-muted)]'}"
		title={sync.lastError ?? label}
		aria-label={label}
	>
		{#if state === 'error'}
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
		{:else if state === 'syncing'}
			<svg class="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
		{:else if state === 'clean'}
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
		{:else}
			<!-- dirty -->
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
		{/if}
		<span>{label}</span>
	</button>
{/if}
