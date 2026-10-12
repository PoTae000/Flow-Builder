<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { sanitizeName } from '$lib/utils/sanitize';
	import { i18n } from '$lib/i18n';
	import type { AttributeType } from '$lib/types/er';

	let {
		entityId
	}: {
		entityId: string;
	} = $props();

	let attrName = $state('');
	let attrType = $state<AttributeType>('regular');

	const attrTypeKeys: { value: AttributeType; key: 'attr.type.regular' | 'attr.type.primary_key' | 'attr.type.foreign_key' | 'attr.type.partial_key' | 'attr.type.derived' | 'attr.type.multivalued' }[] = [
		{ value: 'regular', key: 'attr.type.regular' },
		{ value: 'primary_key', key: 'attr.type.primary_key' },
		{ value: 'foreign_key', key: 'attr.type.foreign_key' },
		{ value: 'partial_key', key: 'attr.type.partial_key' },
		{ value: 'derived', key: 'attr.type.derived' },
		{ value: 'multivalued', key: 'attr.type.multivalued' }
	];

	function addAttribute() {
		const name = sanitizeName(attrName);
		if (!name) return;
		diagram.addAttribute(entityId, {
			name,
			type: attrType
		});
		attrName = '';
		attrType = 'regular';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') addAttribute();
	}
</script>

<div class="flex min-w-0 flex-col gap-2 rounded-lg border border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] p-3">
	<span class="text-xs font-normal text-[var(--ui-text-muted)]">{i18n.t('attr.add.label')}</span>

	<div class="flex min-w-0 gap-2">
		<input
			type="text"
			bind:value={attrName}
			onkeydown={handleKeydown}
			placeholder={i18n.t('attr.add.placeholder')}
			maxlength={100}
			class="min-w-0 flex-1 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2.5 py-1.5 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
		/>
		<select
			bind:value={attrType}
			class="min-w-0 shrink-0 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-sm text-[var(--ui-text)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
		>
			{#each attrTypeKeys as t}
				<option value={t.value}>{i18n.t(t.key)}</option>
			{/each}
		</select>
	</div>

	<div class="flex justify-end">
		<button
			onclick={addAttribute}
			disabled={!attrName.trim()}
			class="rounded-md bg-[var(--ui-accent)] px-3 py-1.5 text-xs font-normal text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{i18n.t('attr.add.button')}
		</button>
	</div>
</div>
