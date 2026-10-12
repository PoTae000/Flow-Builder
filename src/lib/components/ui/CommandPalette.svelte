<script lang="ts">
	import { tick } from 'svelte';

	export interface Command {
		id: string;
		
		label: string;
		
		hint?: string;
		
		keywords?: string;
		
		icon?: string;
		
		group?: string;
		
		run: () => void;
		
		enabled?: boolean;
	}

	let { commands, onclose }: { commands: Command[]; onclose: () => void } = $props();

	let query = $state('');
	let active = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLDivElement | null>(null);

	
	function score(text: string, q: string): number {
		if (!q) return 0;
		text = text.toLowerCase();
		q = q.toLowerCase();
		
		const idx = text.indexOf(q);
		if (idx !== -1) return 1000 - idx;
		
		let ti = 0;
		let hits = 0;
		let streak = 0;
		let best = 0;
		for (let qi = 0; qi < q.length; qi++) {
			const c = q[qi];
			let found = false;
			while (ti < text.length) {
				if (text[ti] === c) {
					hits++;
					streak++;
					best = Math.max(best, streak);
					ti++;
					found = true;
					break;
				}
				streak = 0;
				ti++;
			}
			if (!found) return -1;
		}
		return hits * 4 + best * 6;
	}

	const filtered = $derived.by(() => {
		const list = commands.filter((c) => c.enabled !== false);
		const q = query.trim();
		if (!q) return list;
		return list
			.map((c) => ({ c, s: Math.max(score(c.label, q), score(c.keywords ?? '', q)) }))
			.filter((x) => x.s >= 0)
			.sort((a, b) => b.s - a.s)
			.map((x) => x.c);
	});

	
	$effect(() => {
		filtered;
		if (active >= filtered.length) active = Math.max(0, filtered.length - 1);
	});

	function choose(cmd: Command | undefined) {
		if (!cmd) return;
		onclose();
		
		queueMicrotask(() => cmd.run());
	}

	async function scrollActiveIntoView() {
		await tick();
		listEl?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (filtered.length) active = (active + 1) % filtered.length;
			scrollActiveIntoView();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (filtered.length) active = (active - 1 + filtered.length) % filtered.length;
			scrollActiveIntoView();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			choose(filtered[active]);
		}
	}

	$effect(() => {
		inputEl?.focus();
	});
</script>


<div
	class="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
	onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
	onkeydown={onkeydown}
	role="dialog"
	aria-modal="true"
	aria-label="Command Palette"
	tabindex="-1"
>
	<div
		class="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl"
	>
		
		<div class="flex items-center gap-3 border-b border-[var(--ui-border)] px-4 py-3">
			<svg class="h-5 w-5 shrink-0 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input
				bind:this={inputEl}
				bind:value={query}
				oninput={() => (active = 0)}
				placeholder="พิมพ์คำสั่ง… (เช่น export, quiz, AI)"
				class="w-full bg-transparent text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:outline-none"
				spellcheck="false"
				autocomplete="off"
			/>
			<kbd class="hidden shrink-0 rounded border border-[var(--ui-border)] px-1.5 py-0.5 text-[10px] text-[var(--ui-text-muted)] sm:block">ESC</kbd>
		</div>

		
		<div bind:this={listEl} class="min-h-0 flex-1 overflow-y-auto py-2">
			{#if filtered.length === 0}
				<div class="px-4 py-8 text-center text-sm text-[var(--ui-text-muted)]">ไม่พบคำสั่ง</div>
			{:else}
				{#each filtered as cmd, i (cmd.id)}
					{@const showGroup = !query.trim() && (i === 0 || filtered[i - 1].group !== cmd.group) && cmd.group}
					{#if showGroup}
						<div class="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
							{cmd.group}
						</div>
					{/if}
					<button
						data-active={i === active}
						class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition
							{i === active ? 'bg-[var(--ui-accent)]/12 text-[var(--ui-text)]' : 'text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)]'}"
						onmousemove={() => (active = i)}
						onclick={() => choose(cmd)}
					>
						{#if cmd.icon}
							<svg class="h-4 w-4 shrink-0 {i === active ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)]'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={cmd.icon} />
							</svg>
						{:else}
							<span class="h-4 w-4 shrink-0"></span>
						{/if}
						<span class="flex-1 truncate">{cmd.label}</span>
						{#if cmd.hint}
							<span class="shrink-0 text-[11px] text-[var(--ui-text-muted)]">{cmd.hint}</span>
						{/if}
					</button>
				{/each}
			{/if}
		</div>

		
		<div class="flex items-center justify-between border-t border-[var(--ui-border)] px-4 py-2 text-[10px] text-[var(--ui-text-muted)]">
			<span class="flex items-center gap-2">
				<kbd class="rounded border border-[var(--ui-border)] px-1">↑</kbd>
				<kbd class="rounded border border-[var(--ui-border)] px-1">↓</kbd>
				เลื่อน
				<kbd class="rounded border border-[var(--ui-border)] px-1">↵</kbd>
				เลือก
			</span>
			<span>{filtered.length} คำสั่ง</span>
		</div>
	</div>
</div>
