<script lang="ts">
	import { onMount } from 'svelte';

	
	export type MenuItem = {
		label?: string;
		icon?: string;
		action?: () => void;
		danger?: boolean;
		divider?: boolean;
		
		kind?: 'toggles' | 'stepper' | 'color';
		
		toggles?: { label: string; active: boolean; bold?: boolean; italic?: boolean; onToggle: () => void }[];
		
		value?: number;
		onDec?: () => void;
		onInc?: () => void;
		
		colors?: string[];
		current?: string;
		onPick?: (color: string) => void;
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


<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="context-menu-backdrop"
	onmousedown={onclose}
	ontouchstart={onclose}
></div>


<div
	bind:this={menuEl}
	class="context-menu"
	style="left: {adjustedX}px; top: {adjustedY}px;"
	role="menu"
>
	{#each items as item}
		{#if item.divider}
			<div class="context-menu-divider"></div>
		{/if}

		{#if item.kind === 'toggles' && item.toggles}
			<div class="context-menu-row">
				{#if item.label}<span class="context-menu-row-label">{item.label}</span>{/if}
				<div class="context-menu-row-controls">
					{#each item.toggles as t}
						<button
							class="ctl-btn"
							class:active={t.active}
							style="{t.bold ? 'font-weight:700;' : ''}{t.italic ? 'font-style:italic;' : ''}"
							onclick={() => t.onToggle()}
						>{t.label}</button>
					{/each}
				</div>
			</div>
		{:else if item.kind === 'stepper'}
			<div class="context-menu-row">
				{#if item.label}<span class="context-menu-row-label">{item.label}</span>{/if}
				<div class="context-menu-row-controls">
					<button class="ctl-btn" onclick={() => item.onDec?.()} aria-label="ลด">−</button>
					<span class="ctl-value">{item.value}</span>
					<button class="ctl-btn" onclick={() => item.onInc?.()} aria-label="เพิ่ม">+</button>
				</div>
			</div>
		{:else if item.kind === 'color' && item.colors}
			<div class="context-menu-row">
				{#if item.label}<span class="context-menu-row-label">{item.label}</span>{/if}
				<div class="context-menu-row-controls">
					{#each item.colors as c}
						<button
							class="swatch"
							class:active={item.current === c}
							style="background:{c};"
							aria-label={c}
							onclick={() => item.onPick?.(c)}
						></button>
					{/each}
					<label class="swatch swatch-custom" aria-label="เลือกสีเอง">
						<input
							type="color"
							value={item.current ?? '#ffffff'}
							oninput={(e) => item.onPick?.(e.currentTarget.value)}
						/>
					</label>
				</div>
			</div>
		{:else}
			<button
				class="context-menu-item"
				class:danger={item.danger}
				role="menuitem"
				onclick={() => item.action?.()}
			>
				{#if item.icon}
					<span class="context-menu-icon">{item.icon}</span>
				{/if}
				<span>{item.label}</span>
			</button>
		{/if}
	{/each}
</div>

<style>
	.context-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9998;
	}

	@keyframes menuPopIn {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
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
		animation: menuPopIn 0.12s ease-out;
		transform-origin: top left;
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

	.context-menu-item {
		transition: background-color 0.1s ease, padding-left 0.1s ease;
	}

	.context-menu-item:hover {
		background: var(--ui-hover);
		padding-left: 18px;
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

	/* Rich control rows (format) */
	.context-menu-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 6px 14px;
	}
	.context-menu-row-label {
		font-size: 12px;
		color: var(--ui-text-muted, #888);
		white-space: nowrap;
	}
	.context-menu-row-controls {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.ctl-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 6px;
		border: 1px solid var(--ui-border);
		border-radius: 6px;
		background: none;
		color: var(--ui-text);
		font-size: 13px;
		font-family: 'Kanit', sans-serif;
		cursor: pointer;
		transition: background-color 0.1s ease, border-color 0.1s ease;
	}
	.ctl-btn:hover { background: var(--ui-hover); }
	.ctl-btn.active {
		border-color: #3b82f6;
		background: rgba(59, 130, 246, 0.12);
		color: #3b82f6;
	}
	.ctl-value {
		min-width: 26px;
		text-align: center;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.swatch {
		width: 20px;
		height: 20px;
		padding: 0;
		border: 1px solid var(--ui-border);
		border-radius: 5px;
		cursor: pointer;
		position: relative;
	}
	.swatch.active {
		box-shadow: 0 0 0 2px #3b82f6;
	}
	.swatch-custom {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
	}
	.swatch-custom input {
		position: absolute;
		inset: 0;
		opacity: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}
</style>
