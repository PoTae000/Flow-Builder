<script lang="ts">
	import type { DiagramType } from '$lib/types/diagram';

	let { onchoose, onclose }: { onchoose: (type: DiagramType, name: string) => void; onclose?: () => void } = $props();

	let selectedType = $state<DiagramType | null>(null);
	let diagramName = $state('');
	let nameInput = $state<HTMLInputElement | null>(null);

	const cards: { type: DiagramType; title: string; subtitle: string; color: string }[] = [
		{
			type: 'er',
			title: 'ER Diagram',
			subtitle: 'Entity-Relationship Diagram',
			color: 'var(--ui-accent)'
		},
		{
			type: 'flowchart',
			title: 'Flowchart',
			subtitle: 'Process flow diagram',
			color: '#8b5cf6'
		},
		{
			type: 'context',
			title: 'Context Diagram',
			subtitle: 'DFD Level 0',
			color: '#f59e0b'
		}
	];

	const selectedCard = $derived(cards.find(c => c.type === selectedType));

	function selectType(type: DiagramType) {
		selectedType = type;
		const card = cards.find(c => c.type === type);
		diagramName = card?.title ?? '';
		requestAnimationFrame(() => nameInput?.select());
	}

	function confirm() {
		if (!selectedType) return;
		const name = diagramName.trim() || selectedCard?.title || 'Untitled';
		onchoose(selectedType, name);
	}

	function goBack() {
		selectedType = null;
		diagramName = '';
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
	onkeydown={(e) => { if (e.key === 'Escape') e.stopPropagation(); }}
>
	{#if !selectedType}
		<!-- Step 1: Choose type -->
		<div class="flex flex-col items-center gap-8 px-4">
			<div class="text-center">
				<h1 class="text-2xl font-semibold text-[var(--ui-text)]">สร้าง Diagram ใหม่</h1>
				<p class="mt-1 text-sm text-[var(--ui-text-muted)]">เลือกประเภท Diagram ที่ต้องการ</p>
			</div>

			{#if onclose}
				<button
					class="absolute top-5 left-5 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
					onclick={onclose}
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
					กลับ
				</button>
			{/if}

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				{#each cards as card}
					<button
						class="group flex w-64 flex-col items-center gap-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-6 shadow-lg transition-all duration-200 hover:scale-[1.03] hover:shadow-xl hover:border-[var(--ui-text-muted)] active:scale-[0.98]"
						onclick={() => selectType(card.type)}
					>
						<div
							class="flex h-16 w-16 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
							style="background: {card.color}20;"
						>
							{#if card.type === 'er'}
								<svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke={card.color} stroke-width="1.5">
									<rect x="2" y="3" width="8" height="6" rx="1" />
									<rect x="14" y="3" width="8" height="6" rx="1" />
									<rect x="8" y="15" width="8" height="6" rx="1" />
									<path d="M6 9v2.5a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5V9" />
									<path d="M12 13v2" />
								</svg>
							{:else if card.type === 'flowchart'}
								<svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke={card.color} stroke-width="1.5">
									<rect x="7" y="2" width="10" height="5" rx="1" />
									<path d="M12 7v3" />
									<polygon points="12,10 17,14 12,18 7,14" />
									<path d="M12 18v3" />
									<rect x="7" y="21" width="10" height="0.5" rx="0.25" />
								</svg>
							{:else}
								<svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke={card.color} stroke-width="1.5">
									<circle cx="12" cy="12" r="5" />
									<rect x="1" y="2" width="5" height="4" rx="0.5" />
									<rect x="18" y="2" width="5" height="4" rx="0.5" />
									<rect x="18" y="18" width="5" height="4" rx="0.5" />
									<rect x="1" y="18" width="5" height="4" rx="0.5" />
									<path d="M6 4h1.5M16.5 4H18M18 20h-1.5M6 20h-1.5" />
									<path d="M7 8l2.5 2M17 8l-2.5 2M17 16l-2.5-2M7 16l2.5-2" />
								</svg>
							{/if}
						</div>

						<div class="text-center">
							<h2 class="text-base font-medium text-[var(--ui-text)]">{card.title}</h2>
							<p class="mt-0.5 text-xs text-[var(--ui-text-muted)]">{card.subtitle}</p>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Step 2: Name the diagram -->
		<div class="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-6 shadow-xl mx-4">
			<!-- Back + header -->
			<div class="flex items-center gap-3">
				<button
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
					onclick={goBack}
					aria-label="กลับ"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
				</button>
				<div>
					<h2 class="text-lg font-semibold text-[var(--ui-text)]">ตั้งชื่อ Diagram</h2>
					<p class="text-xs text-[var(--ui-text-muted)]">{selectedCard?.title} — {selectedCard?.subtitle}</p>
				</div>
			</div>

			<!-- Name input -->
			<div class="flex flex-col gap-1.5">
				<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">ชื่อ</span>
				<input
					bind:this={nameInput}
					bind:value={diagramName}
					class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2.5 text-sm text-[var(--ui-text)] shadow-sm transition placeholder:text-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
					placeholder="เช่น ระบบจัดการร้านค้า"
					onkeydown={(e) => { if (e.key === 'Enter') confirm(); }}
				/>
			</div>

			<!-- Confirm button -->
			<button
				class="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--ui-accent-text)] shadow-sm transition hover:opacity-90 active:opacity-80"
				style="background: {selectedCard?.color};"
				onclick={confirm}
			>
				สร้าง Diagram
			</button>
		</div>
	{/if}
</div>
