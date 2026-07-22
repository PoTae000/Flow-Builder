<script lang="ts">
	import { suggestions } from '$lib/stores/suggestions.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';

	let expanded = $state(false);

	const hasItems = $derived(
		diagram.diagramType === 'er' ? diagram.entities.length > 0
		: diagram.diagramType === 'context' ? diagram.dfdNodes.length > 0
		: diagram.diagramType === 'flowchart' ? diagram.flowNodes.length > 0
		: false
	);

	const hasSuggestions = $derived(
		hasItems &&
		!suggestions.dismissed &&
		suggestions.suggestions.length > 0 &&
		!suggestions.loading
	);

	const isLoading = $derived(hasItems && suggestions.loading);
</script>

<!-- Desktop only: hidden on mobile -->
<div class="suggestion-wrapper">
	{#if hasSuggestions || isLoading}
		{#if expanded && hasSuggestions}
			<!-- Expanded panel (lightbulb hidden while open) -->
			<div class="suggestion-panel">
				<div class="suggestion-content">
					<!-- Header -->
					<div class="flex items-center gap-2">
						<svg class="h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
						</svg>
						<span class="text-[10px] font-semibold text-[var(--ui-text-muted)] uppercase tracking-wide">คำแนะนำ</span>
						<div class="flex-1"></div>
						<button
							onclick={() => { expanded = false; }}
							class="shrink-0 rounded p-0.5 text-[var(--ui-text-muted)] transition hover:text-[var(--ui-text)]"
							aria-label="ซ่อนคำแนะนำ"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Suggestions list -->
					{#each suggestions.suggestions as s}
						<div class="suggestion-item flex items-start gap-2 px-1 py-1">
							<span class="mt-1 shrink-0 text-amber-500 text-[8px]">●</span>
							<div class="min-w-0">
								<p class="text-[11px] font-medium text-[var(--ui-text)] leading-snug">{s.text}</p>
								<p class="mt-0.5 text-[10px] text-[var(--ui-text-muted)] leading-relaxed">{s.detail}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Toggle button (shown only when panel is closed) -->
			<button
				class="suggestion-toggle"
				class:has-data={hasSuggestions}
				class:loading={isLoading}
				onclick={() => { expanded = true; }}
				aria-label="ดูคำแนะนำ"
			>
				{#if isLoading}
					<svg class="h-4 w-4 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
					</svg>
				{:else}
					<svg class="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
					<span class="suggestion-badge">{suggestions.suggestions.length}</span>
				{/if}
			</button>
		{/if}
	{/if}
</div>

<style>
	.suggestion-wrapper {
		position: absolute;
		left: 12px;
		top: 12px;
		z-index: 9;
	}

	/* Hidden on mobile */
	@media (max-width: 768px) {
		.suggestion-wrapper {
			display: none;
		}
	}

	.suggestion-toggle {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		border: 1px solid var(--ui-border);
		background: var(--ui-bg);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}
	.suggestion-toggle:hover {
		transform: scale(1.08);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
	}
	.suggestion-toggle.has-data {
		animation: gentlePulse 3s ease-in-out infinite;
	}
	.suggestion-toggle.loading {
		animation: none;
	}

	.suggestion-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 16px;
		height: 16px;
		border-radius: 9px;
		background: #f59e0b;
		color: white;
		font-size: 9px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 4px;
		line-height: 1;
	}

	.suggestion-panel {
		animation: slideDown 0.2s ease-out;
	}

	.suggestion-content {
		display: flex;
		flex-direction: column;
		gap: 4px;
		border-radius: 12px;
		border: 1px solid var(--ui-border);
		background: var(--ui-bg);
		padding: 8px 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		min-width: 240px;
		max-width: min(400px, calc(100vw - 3rem));
		max-height: calc(100vh - 8rem);
		overflow: auto;
	}

	@keyframes gentlePulse {
		0%, 100% { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
		50% { box-shadow: 0 2px 12px rgba(245, 158, 11, 0.25); }
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
