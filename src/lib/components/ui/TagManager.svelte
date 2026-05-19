<script lang="ts">
	import { session } from '$lib/stores/session.svelte';

	let {
		diagramId,
		onclose
	}: {
		diagramId: string;
		onclose: () => void;
	} = $props();

	const diagram = $derived(session.diagrams.find((d) => d.id === diagramId));
	const tags = $derived(diagram?.tags || []);

	let newTag = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		inputEl?.focus();
	});

	function addTag() {
		const trimmed = newTag.trim();
		if (trimmed && diagramId) {
			session.addTag(diagramId, trimmed);
			newTag = '';
		}
	}

	function removeTag(tag: string) {
		if (diagramId) {
			session.removeTag(diagramId, tag);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		} else if (e.key === 'Escape') {
			onclose();
		}
	}

	// Predefined tag colors for variety
	const tagColors = [
		'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
		'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
		'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
		'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
		'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
	];

	function getTagColor(tag: string) {
		// Simple hash to pick a color
		let hash = 0;
		for (let i = 0; i < tag.length; i++) {
			hash = tag.charCodeAt(i) + ((hash << 5) - hash);
		}
		return tagColors[Math.abs(hash) % tagColors.length];
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
	onclick={onclose}
	onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="w-80 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-4 shadow-lg"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-sm font-medium text-[var(--ui-text)]">จัดการ Tags</h3>
			<button
				class="flex h-6 w-6 items-center justify-center rounded text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				aria-label="Close"
				onclick={onclose}
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
			</button>
		</div>

		<!-- Add tag input -->
		<div class="mb-3 flex gap-2">
			<input
				bind:this={inputEl}
				bind:value={newTag}
				type="text"
				placeholder="เพิ่ม tag..."
				class="flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1 text-sm text-[var(--ui-text)] outline-none focus:border-blue-500"
				onkeydown={handleKeydown}
			/>
			<button
				class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
				onclick={addTag}
			>
				เพิ่ม
			</button>
		</div>

		<!-- Tag list -->
		<div class="space-y-1.5">
			{#if tags.length === 0}
				<p class="text-xs text-[var(--ui-text-muted)]">ยังไม่มี tag</p>
			{:else}
				{#each tags as tag}
					<div class="flex items-center justify-between rounded px-2 py-1 {getTagColor(tag)}">
						<span class="text-xs font-medium">{tag}</span>
						<button
							class="flex h-4 w-4 items-center justify-center rounded hover:bg-black/10"
							aria-label="Remove tag"
							onclick={() => removeTag(tag)}
						>
							<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
						</button>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
