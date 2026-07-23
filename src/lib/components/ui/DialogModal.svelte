<script lang="ts">
	import { dialog } from '$lib/stores/dialog.svelte';

	function handleKeydown(e: KeyboardEvent) {
		if (!dialog.current) return;
		if (e.key === 'Escape') dialog.close(false);
		if (e.key === 'Enter') dialog.close(true);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if dialog.current}
	{@const d = dialog.current}
	{@const isDanger = d.variant === 'danger' || !d.variant}
	{@const showCancel = d.cancelText !== ''}

	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] dialog-backdrop"
		onclick={() => dialog.close(false)}
		onkeydown={() => {}}
	></div>

	<!-- Dialog -->
	<div class="fixed left-1/2 top-1/2 z-[61] w-[calc(100vw-2rem)] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-5 shadow-2xl dialog-content">
		<!-- Icon + Title -->
		<div class="mb-3 flex items-start gap-3">
			{#if isDanger}
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10">
					<svg class="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
				</div>
			{:else}
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
					<svg class="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				</div>
			{/if}
			<div>
				<h3 class="text-sm font-medium text-[var(--ui-text)]">{d.title}</h3>
				<p class="mt-1 text-xs text-[var(--ui-text-muted)]">{d.message}</p>
			</div>
		</div>

		<!-- Buttons -->
		<div class="flex justify-end gap-2">
			{#if showCancel}
				<button
					onclick={() => dialog.close(false)}
					class="rounded-lg border border-[var(--ui-border)] px-4 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>
					{d.cancelText ?? 'ยกเลิก'}
				</button>
			{/if}
			<button
				onclick={() => dialog.close(true)}
				class="rounded-lg px-4 py-1.5 text-xs font-medium text-white transition {isDanger
					? 'bg-red-500 hover:bg-red-600'
					: 'bg-[var(--ui-accent)] hover:opacity-90 text-[var(--ui-accent-text)]'}"
			>
				{d.confirmText ?? 'ยืนยัน'}
			</button>
		</div>
	</div>
{/if}

<style>
	@keyframes backdropFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes dialogSlideIn {
		from { opacity: 0; scale: 0.95; }
		to { opacity: 1; scale: 1; }
	}
	.dialog-backdrop {
		animation: backdropFadeIn 0.15s ease-out;
	}
	.dialog-content {
		animation: dialogSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
</style>
