<script lang="ts">
	import { agent } from '$lib/stores/agent.svelte';
	import type { AgentAction } from '$lib/types/agent';

	function actionSummary(actions: AgentAction[]): string {
		const adds = actions.filter(a => a.op.startsWith('add-')).length;
		const removes = actions.filter(a => a.op.startsWith('remove-')).length;
		const parts: string[] = [];
		if (adds) parts.push(`+${adds}`);
		if (removes) parts.push(`-${removes}`);
		return parts.join(' ') || '1 action';
	}
</script>

{#if agent.suggestions.length > 0}
	<div class="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 animate-slide-up">
		<div class="flex items-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 shadow-lg">
			<svg class="h-4 w-4 shrink-0 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
			</svg>

			<div class="flex flex-wrap items-center gap-1.5">
				{#each agent.suggestions as suggestion (suggestion.id)}
					<button
						onclick={() => agent.acceptSuggestion(suggestion.id)}
						class="group flex items-center gap-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1 text-[10px] transition hover:border-[var(--ui-accent)] hover:bg-[var(--ui-accent)]/5"
						title={suggestion.description}
					>
						<span class="text-[var(--ui-text-secondary)] group-hover:text-[var(--ui-text)]">{suggestion.label}</span>
						<span class="rounded bg-[var(--ui-accent)]/10 px-1 text-[9px] text-[var(--ui-accent)]">{actionSummary(suggestion.actions)}</span>
					</button>
				{/each}
			</div>

			<button
				onclick={() => agent.dismissSuggestions()}
				class="ml-1 shrink-0 rounded p-0.5 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text-secondary)]"
				aria-label="ปิดข้อแนะนำ"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
			</button>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translate(-50%, 10px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}
	.animate-slide-up {
		animation: slide-up 0.3s ease-out;
	}
</style>
