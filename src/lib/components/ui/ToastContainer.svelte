<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';

	const typeStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
		success: { bg: 'bg-green-50 dark:bg-green-950/60', border: 'border-green-300 dark:border-green-700', text: 'text-green-800 dark:text-green-200', icon: 'M5 13l4 4L19 7' },
		info: { bg: 'bg-blue-50 dark:bg-blue-950/60', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-800 dark:text-blue-200', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
		warning: { bg: 'bg-orange-50 dark:bg-orange-950/60', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-800 dark:text-orange-200', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
		error: { bg: 'bg-red-50 dark:bg-red-950/60', border: 'border-red-300 dark:border-red-700', text: 'text-red-800 dark:text-red-200', icon: 'M6 18L18 6M6 6l12 12' }
	};
</script>

{#if toast.toasts.length > 0}
	<div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
		{#each toast.toasts as t (t.id)}
			{@const s = typeStyles[t.type] || typeStyles.info}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div
				class="pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-2.5 shadow-lg {t.exiting ? 'toast-exit' : 'toast-enter'} {s.bg} {s.border} {s.text}"
				onclick={() => toast.dismiss(t.id)}
				style="cursor: pointer; max-width: 360px;"
			>
				<svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={s.icon} />
				</svg>
				<span class="text-sm">{t.message}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	@keyframes toastSlideIn {
		from { opacity: 0; transform: translateX(100px); }
		to { opacity: 1; transform: translateX(0); }
	}
	@keyframes toastSlideOut {
		from { opacity: 1; transform: translateX(0); }
		to { opacity: 0; transform: translateX(100px); }
	}
	.toast-enter {
		animation: toastSlideIn 0.25s ease-out;
	}
	.toast-exit {
		animation: toastSlideOut 0.2s ease-in forwards;
	}
</style>
