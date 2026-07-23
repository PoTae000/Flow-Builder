<script lang="ts">
	import { sync } from '$lib/stores/sync.svelte';
	import { auth } from '$lib/stores/auth.svelte';

	// Show the status chip only when actively doing something; the manual
	// "Sync now" button is always available while signed in.
	const showStatus = $derived(auth.isSignedIn && sync.status !== 'idle');

	function handleSyncNow() {
		sync.syncNow();
	}
</script>

{#if auth.isSignedIn}
	<div class="flex items-center gap-1.5">
		{#if showStatus}
		<div class="flex items-center gap-1 text-[10px]" title={sync.lastError ?? ''}>
		{#if sync.isPaused}
			<!-- Paused: orange warning -->
			<svg class="h-3.5 w-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span class="hidden sm:inline text-orange-500">Sync หยุดชั่วคราว</span>
			<button
				onclick={() => sync.retrySync()}
				class="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-orange-500 text-white hover:bg-orange-600 transition-colors"
				aria-label="ลอง Sync อีกครั้ง"
			>
				Retry
			</button>
		{:else if sync.status === 'syncing'}
			<!-- Spinning cloud -->
			<svg class="h-3.5 w-3.5 animate-spin text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
			<span class="hidden sm:inline text-[var(--ui-text-muted)]">Syncing...</span>
		{:else if sync.status === 'synced'}
			<!-- Green check cloud -->
			<svg class="h-3.5 w-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
			<span class="hidden sm:inline text-emerald-500">Synced</span>
		{:else if sync.status === 'error'}
			<!-- Red X -->
			<svg class="h-3.5 w-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<span class="hidden sm:inline text-red-500">Sync error</span>
		{/if}
		</div>
		{/if}

		<!-- Manual "Sync now" button — always available while signed in -->
		<button
			onclick={handleSyncNow}
			disabled={sync.status === 'syncing'}
			style="padding:0;min-width:0;min-height:0;"
			class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] disabled:opacity-40"
			title="Sync ตอนนี้"
			aria-label="Sync now"
		>
			<svg class="h-4 w-4 {sync.status === 'syncing' ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
		</button>
	</div>
{/if}
