<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { sanitizeName } from '$lib/utils/sanitize';
	import { i18n } from '$lib/i18n';
	import type { CardinalityType } from '$lib/types/er';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	let relName = $state('');
	let entityA = $state('');
	let entityB = $state('');
	let cardA = $state<CardinalityType>('1');
	let cardB = $state<CardinalityType>('N');

	const cardinalityOptions: { value: CardinalityType; label: string }[] = [
		{ value: '1', label: '1 (one)' },
		{ value: 'N', label: 'N (many)' },
		{ value: 'M', label: 'M (many)' },
		{ value: '0..1', label: '0..1' },
		{ value: '0..N', label: '0..N' },
		{ value: '1..1', label: '1..1' },
		{ value: '1..N', label: '1..N' }
	];

	function addRelationship() {
		const name = sanitizeName(relName);
		if (!name || !entityA || !entityB) return;
		diagram.addRelationship(name, [entityA, entityB], [cardA, cardB]);
		relName = '';
		entityA = '';
		entityB = '';
		cardA = '1';
		cardB = 'N';
		onclose();
	}

	const canAdd = $derived(relName.trim() && entityA && entityB && entityA !== entityB);
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/50 animate-fade-in"
	onclick={onclose}
	onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
></div>

<!-- Popup -->
<div class="fixed left-1/2 top-1/2 z-50 w-[380px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-5 shadow-2xl animate-scale-in">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-sm font-normal text-[var(--ui-text)]">{i18n.t('rel.add.title')}</h2>
		<button
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			onclick={onclose}
			title="Close"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<div class="flex flex-col gap-3">
		<input
			type="text"
			bind:value={relName}
			placeholder={i18n.t('rel.add.placeholder')}
			maxlength={100}
			class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
		/>

		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1">
				<span class="text-xs text-[var(--ui-text-muted)]">{i18n.t('rel.from')}</span>
				<select
					bind:value={entityA}
					class="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1.5 text-sm text-[var(--ui-text)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
				>
					<option value="">{i18n.t('rel.select')}</option>
					{#each diagram.entities as e}
						<option value={e.id}>{e.name}</option>
					{/each}
				</select>
				<select
					bind:value={cardA}
					class="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1.5 text-sm text-[var(--ui-text)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
				>
					{#each cardinalityOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>

			<div class="flex flex-col gap-1">
				<span class="text-xs text-[var(--ui-text-muted)]">{i18n.t('rel.to')}</span>
				<select
					bind:value={entityB}
					class="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1.5 text-sm text-[var(--ui-text)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
				>
					<option value="">{i18n.t('rel.select')}</option>
					{#each diagram.entities as e}
						<option value={e.id}>{e.name}</option>
					{/each}
				</select>
				<select
					bind:value={cardB}
					class="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1.5 text-sm text-[var(--ui-text)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
				>
					{#each cardinalityOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if entityA && entityB && entityA === entityB}
			<p class="text-xs text-red-500">ไม่สามารถสร้างความสัมพันธ์กับตัวเองได้</p>
		{/if}

		<button
			onclick={addRelationship}
			disabled={!canAdd}
			class="w-full rounded-lg bg-[var(--ui-accent)] px-4 py-2 text-sm font-normal text-[var(--ui-accent-text)] shadow-sm transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{i18n.t('rel.add.button')}
		</button>
	</div>
</div>
