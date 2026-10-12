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
	const menuId = $props.id();
	function mountDropdown(node: HTMLDivElement) {
		const anchor = triggerEl;
		if (!anchor) return;
		const styles = getComputedStyle(anchor);
		for (const name of ['--ui-bg', '--ui-bg-secondary', '--ui-bg-tertiary', '--ui-border', '--ui-text', '--ui-text-secondary', '--ui-text-muted', '--ui-hover']) node.style.setProperty(name, styles.getPropertyValue(name));
		document.body.appendChild(node);
		function position() {
			const rect = anchor!.getBoundingClientRect();
			const below = innerHeight - rect.bottom - 12;
			const above = rect.top - 12;
			const upward = below < 160 && above > below;
			const height = Math.min(240, Math.max(40, upward ? above : below));
			node.style.width = `${Math.min(rect.width, innerWidth - 16)}px`;
			node.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - rect.width - 8))}px`;
			node.style.maxHeight = `${height}px`;
			node.style.top = upward ? 'auto' : `${rect.bottom + 4}px`;
			node.style.bottom = upward ? `${innerHeight - rect.top + 4}px` : 'auto';
		}
		position();
		window.addEventListener('resize', position);
		window.addEventListener('scroll', position, true);
		return { destroy() { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); node.remove(); } };
	}
	function revealItem(item: Element | null | undefined) {
		if (!(item instanceof HTMLElement) || !dropdownEl) return;
		if (item.offsetTop < dropdownEl.scrollTop) dropdownEl.scrollTop = item.offsetTop;
		else if (item.offsetTop + item.offsetHeight > dropdownEl.scrollTop + dropdownEl.clientHeight) dropdownEl.scrollTop = item.offsetTop + item.offsetHeight - dropdownEl.clientHeight;
	}

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
			revealItem(item);
		});
	}

	function handleTriggerKeydown(e: KeyboardEvent) {
		if (open) { handleDropdownKeydown(e); return; }
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
			
			tick().then(() => {
				const selected = dropdownEl?.querySelector('[data-selected="true"]');
				revealItem(selected);
			});
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative">
	<button
		bind:this={triggerEl}
		type="button"
		role="combobox"
		aria-expanded={open}
		aria-controls={menuId}
		aria-haspopup="listbox"
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
			use:mountDropdown
			id={menuId}
			role="listbox"
			tabindex="-1"
			onkeydown={handleDropdownKeydown}
			class="fixed z-[500] overflow-y-auto rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-lg"
		>
			{#each options as opt, i}
				<button
					type="button"
					role="option"
					aria-selected={opt.value === value}
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
