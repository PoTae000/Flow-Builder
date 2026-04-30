<script lang="ts">
	import { tick } from 'svelte';

	type Option = { value: string; label: string };

	let {
		options,
		value = $bindable(),
		onchange
	}: {
		options: Option[];
		value: string;
		onchange?: (val: string) => Promise<boolean | void> | boolean | void;
	} = $props();

	let open = $state(false);
	let highlightedIndex = $state(-1);
	let triggerEl: HTMLButtonElement | undefined = $state();
	let dropdownEl: HTMLDivElement | undefined = $state();

	const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? value);

	async function select(opt: Option) {
		if (opt.value === value) {
			open = false;
			return;
		}
		if (onchange) {
			const result = await onchange(opt.value);
			if (result === false) {
				open = false;
				return;
			}
		}
		value = opt.value;
		open = false;
	}

	function openDropdown() {
		open = true;
		highlightedIndex = options.findIndex((o) => o.value === value);
		if (highlightedIndex < 0) highlightedIndex = 0;
	}

	function toggle() {
		if (open) {
			open = false;
		} else {
			openDropdown();
		}
	}

	function scrollHighlightedIntoView() {
		tick().then(() => {
			const item = dropdownEl?.querySelector(`[data-index="${highlightedIndex}"]`);
			item?.scrollIntoView({ block: 'nearest' });
		});
	}

	function handleTriggerKeydown(e: KeyboardEvent) {
		if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			openDropdown();
		}
	}

	function handleDropdownKeydown(e: KeyboardEvent) {
		if (!open) return;
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightedIndex = (highlightedIndex + 1) % options.length;
				scrollHighlightedIntoView();
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = (highlightedIndex - 1 + options.length) % options.length;
				scrollHighlightedIntoView();
				break;
			case 'Home':
				e.preventDefault();
				highlightedIndex = 0;
				scrollHighlightedIntoView();
				break;
			case 'End':
				e.preventDefault();
				highlightedIndex = options.length - 1;
				scrollHighlightedIntoView();
				break;
			case 'Enter':
				e.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < options.length) {
					select(options[highlightedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				open = false;
				triggerEl?.focus();
				break;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as Node;
		if (triggerEl?.contains(target) || dropdownEl?.contains(target)) return;
		open = false;
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside, true);
			return () => document.removeEventListener('click', handleClickOutside, true);
		}
	});

	$effect(() => {
		if (open && dropdownEl) {
			// Scroll selected item into view on open
			tick().then(() => {
				const selected = dropdownEl?.querySelector('[data-selected="true"]');
				selected?.scrollIntoView({ block: 'nearest' });
			});
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative" onkeydown={handleDropdownKeydown}>
	<button
		bind:this={triggerEl}
		type="button"
		class="flex w-full items-center justify-between rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm font-light text-[var(--ui-text)] shadow-sm transition hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
		onclick={toggle}
		onkeydown={handleTriggerKeydown}
	>
		<span class="truncate">{selectedLabel}</span>
		<svg
			class="ml-2 h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)] transition-transform duration-200 {open ? 'rotate-180' : ''}"
			fill="none" stroke="currentColor" viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if open}
		<div
			bind:this={dropdownEl}
			class="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-lg animate-slide-up"
		>
			{#each options as opt, i}
				<button
					type="button"
					data-selected={opt.value === value}
					data-index={i}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-light transition
						{highlightedIndex === i
							? 'bg-[var(--ui-hover)] text-[var(--ui-text)]'
							: opt.value === value
								? 'bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)]'
								: 'text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]'}"
					onclick={() => select(opt)}
					onmouseenter={() => { highlightedIndex = i; }}
				>
					<span class="w-4 shrink-0 text-center">
						{#if opt.value === value}
							<svg class="h-3.5 w-3.5 text-[var(--ui-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
							</svg>
						{/if}
					</span>
					<span class="truncate">{opt.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
