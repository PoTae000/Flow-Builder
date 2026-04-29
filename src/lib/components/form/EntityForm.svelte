<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { sanitizeName } from '$lib/utils/sanitize';
	import { i18n } from '$lib/i18n';

	let entityName = $state('');
	let suggesting = $state(false);
	let suggestions = $state<string[]>([]);
	let showSuggestions = $state(false);

	function addEntity() {
		const name = sanitizeName(entityName);
		if (!name) return;
		diagram.addEntity(name);
		entityName = '';
		suggestions = [];
		showSuggestions = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') addEntity();
	}

	async function suggestNames() {
		suggesting = true;
		showSuggestions = true;
		suggestions = [];
		try {
			const context = diagram.entities.map((e) => e.name).join(', ');
			const res = await fetch('/api/suggest-name', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'entity',
					currentName: entityName,
					context
				})
			});
			if (res.ok) {
				const data = await res.json();
				suggestions = data.suggestions ?? [];
			}
		} catch {
			/* ignore */
		}
		suggesting = false;
	}

	function pickSuggestion(name: string) {
		entityName = name;
		showSuggestions = false;
		suggestions = [];
	}
</script>

<div class="flex flex-col gap-2">
	<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">{i18n.t('entity.add.label')}</span>
	<div data-onboarding="entity-input" class="flex gap-2">
		<div class="relative flex-1">
			<input
				type="text"
				bind:value={entityName}
				onkeydown={handleKeydown}
				placeholder={i18n.t('entity.add.placeholder')}
				maxlength={100}
				class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 pr-8 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-placeholder)] hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
			/>
			<button
				onclick={suggestNames}
				disabled={suggesting}
				class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--ui-text-muted)] transition hover:text-[var(--ui-accent)] disabled:opacity-50"
				title={i18n.t('ai.suggest' as any)}
				aria-label={i18n.t('ai.suggest' as any)}
			>
				{#if suggesting}
					<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
				{:else}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
				{/if}
			</button>

			<!-- Suggestions dropdown -->
			{#if showSuggestions && (suggestions.length > 0 || suggesting)}
				<div class="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-1 shadow-lg animate-slide-up">
					{#if suggesting}
						<div class="px-3 py-2 text-xs text-[var(--ui-text-muted)]">{i18n.t('ai.suggesting' as any)}</div>
					{:else if suggestions.length === 0}
						<div class="px-3 py-2 text-xs text-[var(--ui-text-muted)]">{i18n.t('ai.noSuggestions' as any)}</div>
					{:else}
						{#each suggestions as name}
							<button
								class="flex w-full items-center rounded px-3 py-1.5 text-left text-sm text-[var(--ui-text)] transition hover:bg-[var(--ui-hover)]"
								onclick={() => pickSuggestion(name)}
							>
								{name}
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
		<button
			onclick={addEntity}
			disabled={!entityName.trim()}
			class="rounded-lg bg-[var(--ui-accent)] px-4 py-2 text-sm font-normal text-[var(--ui-accent-text)] shadow-sm transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{i18n.t('entity.add.button')}
		</button>
	</div>
</div>
