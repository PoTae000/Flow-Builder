<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let currentIndex = $state(-1); // -1 = current state (no preview)
	let playing = $state(false);
	let playSpeed = $state(1); // 0.5x, 1x, 2x
	let playIntervalId: ReturnType<typeof setInterval> | null = null;

	const totalSteps = $derived(diagram.historyLength);
	const labels = $derived(diagram.historyEntries);

	// Diff stats between step N-1 and step N
	const diffStats = $derived.by(() => {
		if (currentIndex < 0 || totalSteps === 0) return null;
		const snapshots = diagram.historySnapshots;
		if (currentIndex >= snapshots.length) return null;
		try {
			const curr = JSON.parse(snapshots[currentIndex]);
			const prev = currentIndex > 0
				? JSON.parse(snapshots[currentIndex - 1])
				: { entities: [], relationships: [], flowNodes: [], flowEdges: [], dfdNodes: [], dfdFlows: [] };

			return {
				entitiesAdded: (curr.entities ?? []).filter((e: any) => !(prev.entities ?? []).find((p: any) => p.id === e.id)).length,
				entitiesRemoved: (prev.entities ?? []).filter((e: any) => !(curr.entities ?? []).find((p: any) => p.id === e.id)).length,
				relsAdded: (curr.relationships ?? []).filter((r: any) => !(prev.relationships ?? []).find((p: any) => p.id === r.id)).length,
				relsRemoved: (prev.relationships ?? []).filter((r: any) => !(curr.relationships ?? []).find((p: any) => p.id === r.id)).length,
				flowAdded: Math.max(0, (curr.flowNodes?.length ?? 0) - (prev.flowNodes?.length ?? 0)),
				flowRemoved: Math.max(0, (prev.flowNodes?.length ?? 0) - (curr.flowNodes?.length ?? 0)),
				dfdAdded: Math.max(0, (curr.dfdNodes?.length ?? 0) - (prev.dfdNodes?.length ?? 0)),
				dfdRemoved: Math.max(0, (prev.dfdNodes?.length ?? 0) - (curr.dfdNodes?.length ?? 0)),
			};
		} catch {
			return null;
		}
	});

	function goToStep(index: number) {
		if (index < 0 || index >= totalSteps) {
			// Go to current state
			if (diagram.timelinePreviewActive) {
				diagram.exitPreview(false);
			}
			currentIndex = -1;
		} else {
			currentIndex = index;
			diagram.previewHistoryEntry(index);
		}
	}

	function handleSliderInput(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		if (val >= totalSteps) {
			goToStep(-1);
		} else {
			goToStep(val);
		}
	}

	function startPlay() {
		if (totalSteps === 0) return;
		playing = true;
		// Start from beginning if at current state
		if (currentIndex < 0) {
			goToStep(0);
		}
		playIntervalId = setInterval(() => {
			if (currentIndex < 0 || currentIndex >= totalSteps - 1) {
				// Reached end, go to current state
				goToStep(-1);
				stopPlay();
				return;
			}
			goToStep(currentIndex + 1);
		}, 1000 / playSpeed);
	}

	function stopPlay() {
		playing = false;
		if (playIntervalId) {
			clearInterval(playIntervalId);
			playIntervalId = null;
		}
	}

	function togglePlay() {
		if (playing) stopPlay();
		else startPlay();
	}

	function cycleSpeed() {
		stopPlay();
		if (playSpeed === 0.5) playSpeed = 1;
		else if (playSpeed === 1) playSpeed = 2;
		else playSpeed = 0.5;
	}

	function stepBack() {
		stopPlay();
		if (currentIndex < 0) {
			// From current → go to last history entry
			if (totalSteps > 0) goToStep(totalSteps - 1);
		} else if (currentIndex > 0) {
			goToStep(currentIndex - 1);
		}
	}

	function stepForward() {
		stopPlay();
		if (currentIndex < 0) return;
		if (currentIndex < totalSteps - 1) {
			goToStep(currentIndex + 1);
		} else {
			goToStep(-1); // Go to current
		}
	}

	function handleApply() {
		stopPlay();
		diagram.exitPreview(true);
		currentIndex = -1;
		onclose();
	}

	function handleCancel() {
		stopPlay();
		diagram.exitPreview(false);
		currentIndex = -1;
		onclose();
	}

	// Slider value: 0..totalSteps where totalSteps = "Current" position
	const sliderValue = $derived(currentIndex < 0 ? totalSteps : currentIndex);
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 animate-fade-in" onclick={handleCancel} onkeydown={(e) => { if (e.key === 'Escape') handleCancel(); }}></div>

<!-- Panel -->
<div class="fixed z-50 border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-xl animate-scale-in inset-x-0 bottom-0 w-full rounded-t-2xl md:inset-x-auto md:bottom-auto md:top-26 md:right-3 md:w-96 md:rounded-lg">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			<span class="text-sm font-medium text-[var(--ui-text)]">Timeline</span>
			{#if totalSteps > 0}
				<span class="text-xs text-[var(--ui-text-muted)]">({totalSteps} steps)</span>
			{/if}
		</div>
		<button
			class="rounded p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			onclick={handleCancel}
			aria-label="Close timeline"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<div class="p-4">
		{#if totalSteps === 0}
			<div class="py-8 text-center text-xs text-[var(--ui-text-muted)]">
				No history yet
			</div>
		{:else}
			<!-- Diff stats -->
			{#if diffStats}
				<div class="mb-3 flex flex-wrap gap-2 text-xs">
					{#if diffStats.entitiesAdded > 0}
						<span class="rounded bg-green-500/15 px-2 py-0.5 text-green-600 dark:text-green-400">+{diffStats.entitiesAdded} entity</span>
					{/if}
					{#if diffStats.entitiesRemoved > 0}
						<span class="rounded bg-red-500/15 px-2 py-0.5 text-red-600 dark:text-red-400">-{diffStats.entitiesRemoved} entity</span>
					{/if}
					{#if diffStats.relsAdded > 0}
						<span class="rounded bg-green-500/15 px-2 py-0.5 text-green-600 dark:text-green-400">+{diffStats.relsAdded} rel</span>
					{/if}
					{#if diffStats.relsRemoved > 0}
						<span class="rounded bg-red-500/15 px-2 py-0.5 text-red-600 dark:text-red-400">-{diffStats.relsRemoved} rel</span>
					{/if}
					{#if diffStats.flowAdded > 0}
						<span class="rounded bg-green-500/15 px-2 py-0.5 text-green-600 dark:text-green-400">+{diffStats.flowAdded} node</span>
					{/if}
					{#if diffStats.flowRemoved > 0}
						<span class="rounded bg-red-500/15 px-2 py-0.5 text-red-600 dark:text-red-400">-{diffStats.flowRemoved} node</span>
					{/if}
					{#if diffStats.dfdAdded > 0}
						<span class="rounded bg-green-500/15 px-2 py-0.5 text-green-600 dark:text-green-400">+{diffStats.dfdAdded} dfd</span>
					{/if}
					{#if diffStats.dfdRemoved > 0}
						<span class="rounded bg-red-500/15 px-2 py-0.5 text-red-600 dark:text-red-400">-{diffStats.dfdRemoved} dfd</span>
					{/if}
				</div>
			{:else if currentIndex < 0}
				<div class="mb-3 flex items-center gap-2 rounded bg-[var(--ui-bg-secondary)] px-3 py-2">
					<span class="h-2 w-2 rounded-full bg-green-500"></span>
					<span class="text-xs font-medium text-[var(--ui-text)]">Current state</span>
				</div>
			{/if}

			<!-- Step label -->
			{#if currentIndex >= 0}
				<div class="mb-2 text-xs text-[var(--ui-text-secondary)] truncate">
					Step {currentIndex + 1}: {labels[currentIndex] ?? 'Edit'}
				</div>
			{/if}

			<!-- Dot timeline -->
			<div class="mb-3 flex items-center gap-0.5 overflow-x-auto py-1">
				{#each Array(totalSteps) as _, i}
					<button
						class="shrink-0 rounded-full transition-all {currentIndex === i ? 'h-3 w-3 bg-blue-500' : 'h-2 w-2 bg-[var(--ui-text-muted)] opacity-40 hover:opacity-80'}"
						onclick={() => goToStep(i)}
						aria-label="Go to step {i + 1}"
					></button>
				{/each}
				<!-- Current state dot -->
				<button
					class="shrink-0 rounded-full transition-all {currentIndex < 0 ? 'h-3 w-3 bg-green-500' : 'h-2 w-2 bg-green-500 opacity-40 hover:opacity-80'}"
					onclick={() => goToStep(-1)}
					aria-label="Go to current state"
				></button>
			</div>

			<!-- Range slider -->
			<div class="mb-3 flex items-center gap-2">
				<input
					type="range"
					min="0"
					max={totalSteps}
					value={sliderValue}
					oninput={handleSliderInput}
					class="flex-1 h-1.5 cursor-pointer accent-blue-500"
				/>
				<span class="text-xs text-[var(--ui-text-muted)] w-10 text-right">
					{currentIndex < 0 ? 'Now' : `${currentIndex + 1}/${totalSteps}`}
				</span>
			</div>

			<!-- Playback controls -->
			<div class="mb-3 flex items-center justify-center gap-2">
				<button
					class="rounded p-1.5 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] disabled:opacity-30"
					onclick={stepBack}
					disabled={currentIndex === 0}
					aria-label="Step back"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
				</button>

				<button
					class="rounded-full p-2 bg-blue-500 text-white hover:bg-blue-600 transition"
					onclick={togglePlay}
					aria-label={playing ? 'Pause' : 'Play'}
				>
					{#if playing}
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
					{:else}
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
					{/if}
				</button>

				<button
					class="rounded p-1.5 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] disabled:opacity-30"
					onclick={stepForward}
					disabled={currentIndex < 0}
					aria-label="Step forward"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
				</button>

				<button
					class="ml-2 rounded px-2 py-1 text-xs font-mono text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
					onclick={cycleSpeed}
					aria-label="Change speed"
				>
					{playSpeed}x
				</button>
			</div>

			<!-- Apply / Cancel buttons (only when previewing) -->
			{#if diagram.timelinePreviewActive}
				<div class="flex items-center gap-2 border-t border-[var(--ui-border)] pt-3">
					<button
						class="flex-1 rounded bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition"
						onclick={handleApply}
					>
						Apply
					</button>
					<button
						class="flex-1 rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs font-medium text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition"
						onclick={handleCancel}
					>
						Cancel
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
