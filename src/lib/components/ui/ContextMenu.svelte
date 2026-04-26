<script lang="ts">
	import { onMount } from 'svelte';

	type MenuItem = {
		label: string;
		icon?: string;
		action: () => void;
		danger?: boolean;
		divider?: boolean;
	};

	let {
		x,
		y,
		items,
		onclose
	}: {
		x: number;
		y: number;
		items: MenuItem[];
		onclose: () => void;
	} = $props();

	let menuEl: HTMLDivElement | undefined = $state();
	let adjustedX = $state(0);
	let adjustedY = $state(0);

	// Initialize with prop values, then adjust for viewport bounds
	$effect(() => {
		adjustedX = x;
		adjustedY = y;
	});

	onMount(() => {
		if (!menuEl) return;
		const rect = menuEl.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		let ax = x;
		let ay = y;
		if (ax + rect.width > vw) ax = x - rect.width;
		if (ay + rect.height > vh) ay = y - rect.height;
		if (ax < 4) ax = 4;
		if (ay < 4) ay = 4;
		adjustedX = ax;
		adjustedY = ay;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop (invisible) to close menu on outside click -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="context-menu-backdrop"
	onmousedown={onclose}
	ontouchstart={onclose}
></div>

<!-- Menu -->
<div
	bind:this={menuEl}
	class="context-menu"
	style="left: {adjustedX}px; top: {adjustedY}px;"
	role="menu"
>
	{#each items as item, i}
		{#if item.divider}
			<div class="context-menu-divider"></div>
		{/if}
		<button
			class="context-menu-item"
			class:danger={item.danger}
			role="menuitem"
			onclick={() => item.action()}
		>
			{#if item.icon}
				<span class="context-menu-icon">{item.icon}</span>
			{/if}
			<span>{item.label}</span>
		</button>
	{/each}
</div>

<style>
	.context-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9998;
	}

	.context-menu {
		position: fixed;
		z-index: 9999;
		min-width: 160px;
		padding: 4px 0;
		background: var(--ui-bg);
		border: 1px solid var(--ui-border);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
		font-family: 'Kanit', sans-serif;
	}

	.context-menu-divider {
		height: 1px;
		margin: 4px 8px;
		background: var(--ui-border);
	}

	.context-menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 14px;
		border: none;
		background: none;
		color: var(--ui-text);
		font-size: 13px;
		font-family: 'Kanit', sans-serif;
		cursor: pointer;
		text-align: left;
	}

	.context-menu-item:hover {
		background: var(--ui-hover);
	}

	.context-menu-item.danger {
		color: #ef4444;
	}

	.context-menu-item.danger:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	.context-menu-icon {
		font-size: 15px;
		width: 20px;
		text-align: center;
	}
</style>
