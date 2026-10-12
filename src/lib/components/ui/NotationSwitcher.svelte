<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { NOTATION_OPTIONS } from '$lib/types/notation';
	import type { NotationStyle, NotationPreviewType, NotationOption } from '$lib/types/notation';

	let open = $state(false);
	let moreOpen = $state(false);
	let previewNotation = $state<NotationStyle | null>(null);

	const selectedOption = $derived(NOTATION_OPTIONS.find((o) => o.value === diagram.notation));

	const mainOptions = NOTATION_OPTIONS.filter(o => ['crows-foot', 'chen'].includes(o.value));
	const extraOptions = NOTATION_OPTIONS.filter(o => !['crows-foot', 'chen'].includes(o.value));

	async function confirmNotation(val: NotationStyle) {
		if (val !== diagram.notation) {
			if (await collab.requestPermission('change-notation')) {
				diagram.setNotation(val);
			}
		}
		open = false;
		previewNotation = null;
	}
</script>

{#snippet notationSvg(previewType: NotationPreviewType)}
	<svg class="notation-svg" viewBox="0 0 120 32" xmlns="http://www.w3.org/2000/svg">
		{#if previewType === 'crows-foot'}
			<line x1="8" y1="16" x2="78" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<line x1="12" y1="8" x2="12" y2="24" stroke="currentColor" stroke-width="1.3"/>
			<line x1="78" y1="16" x2="112" y2="6" stroke="currentColor" stroke-width="1.3"/>
			<line x1="78" y1="16" x2="112" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<line x1="78" y1="16" x2="112" y2="26" stroke="currentColor" stroke-width="1.3"/>
		{:else if previewType === 'diamond'}
			<line x1="8" y1="16" x2="36" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<polygon points="60,4 84,16 60,28 36,16" fill="none" stroke="currentColor" stroke-width="1.3"/>
			<line x1="84" y1="16" x2="112" y2="16" stroke="currentColor" stroke-width="1.3"/>
		{:else if previewType === 'text-multiplicity'}
			<line x1="8" y1="16" x2="112" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<text x="14" y="12" fill="currentColor" font-size="9" font-weight="400">1</text>
			<text x="106" y="12" text-anchor="end" fill="currentColor" font-size="9" font-weight="400">1..*</text>
		{:else if previewType === 'text-minmax'}
			<line x1="8" y1="16" x2="112" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<text x="14" y="12" fill="currentColor" font-size="8" font-weight="400">(1,1)</text>
			<text x="106" y="12" text-anchor="end" fill="currentColor" font-size="8" font-weight="400">(1,N)</text>
		{:else if previewType === 'dot'}
			<line x1="8" y1="16" x2="112" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<circle cx="108" cy="16" r="3.5" fill="currentColor"/>
			<text x="60" y="12" text-anchor="middle" fill="currentColor" font-size="9" font-weight="400">P</text>
		{:else if previewType === 'arrowhead'}
			<line x1="8" y1="16" x2="108" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<polyline points="100,8 112,16 100,24" fill="none" stroke="currentColor" stroke-width="1.3"/>
		{:else if previewType === 'dashed'}
			<line x1="8" y1="16" x2="50" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<line x1="50" y1="16" x2="112" y2="16" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5,4"/>
		{:else if previewType === 'double-arrow'}
			<line x1="16" y1="16" x2="104" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<polyline points="20,8 8,16 20,24" fill="none" stroke="currentColor" stroke-width="1.3"/>
			<polyline points="100,8 112,16 100,24" fill="none" stroke="currentColor" stroke-width="1.3"/>
		{:else if previewType === 'oval'}
			<line x1="8" y1="16" x2="40" y2="16" stroke="currentColor" stroke-width="1.3"/>
			<ellipse cx="60" cy="16" rx="20" ry="10" fill="none" stroke="currentColor" stroke-width="1.3"/>
			<line x1="80" y1="16" x2="112" y2="16" stroke="currentColor" stroke-width="1.3"/>
		{/if}
	</svg>
{/snippet}

{#snippet optionCard(opt: NotationOption)}
						{@const isActive = opt.value === diagram.notation}
						{@const isPreviewing = previewNotation === opt.value}
						<button
							type="button"
							class="flex flex-col gap-1.5 px-3 py-3 text-left transition w-full border-b border-[var(--ui-border-light)] last:border-b-0
								{isActive
									? 'bg-[var(--ui-bg-tertiary)]'
									: isPreviewing
										? 'bg-[var(--ui-hover)]'
										: 'hover:bg-[var(--ui-hover)]'}"
							onclick={() => confirmNotation(opt.value)}
							onmouseenter={() => { previewNotation = opt.value; }}
							onmouseleave={() => { previewNotation = null; }}
						>
							<div class="flex items-center gap-2.5 w-full">
								{@render notationSvg(opt.previewType)}
								<span class="flex-1 min-w-0 text-sm font-light text-[var(--ui-text)] truncate">{opt.label}</span>
								{#if isActive}
									<svg class="h-3.5 w-3.5 shrink-0 text-[var(--ui-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
									</svg>
								{/if}
							</div>
							<p class="text-[11px] text-[var(--ui-text-muted)] leading-relaxed">{opt.value === 'crows-foot' ? 'ออกแบบตารางฐานข้อมูล — ปลายเส้นขาตกาแสดง 1 ต่อหลาย' : opt.value === 'chen' ? 'อธิบายโครงสร้างข้อมูล — รูปเพชรแสดงความสัมพันธ์' : opt.description}</p>
						</button>
{/snippet}

<div data-onboarding="notation" class="flex flex-col gap-1.5">
	<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">สัญลักษณ์แผนภาพ</span>

		<button
			type="button"
			class="flex w-full items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm font-light text-[var(--ui-text)] shadow-sm transition hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
			aria-expanded={open}
			onclick={() => { open = !open; previewNotation = null; }}
		>
			<span class="truncate flex-1 text-left">{selectedOption?.label ?? diagram.notation}</span>
			<svg class="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)] transition-transform duration-150 {open ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" />
			</svg>
		</button>
	{#if open}
		<div transition:slide={{ duration: 160, easing: cubicOut }} class="flex flex-col rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] overflow-hidden">

			<div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--ui-border-light)]">
				<span class="text-xs font-medium text-[var(--ui-text)]">เลือกสัญลักษณ์แผนภาพ</span>
				<button aria-label="ปิดตัวเลือกสัญลักษณ์" type="button" onclick={() => { open = false; previewNotation = null; }} class="ml-auto rounded p-0.5 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition">
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>


			<div class="max-h-72 overflow-y-auto">
{#each mainOptions as opt}{@render optionCard(opt)}{/each}
<button type="button" aria-expanded={moreOpen} onclick={() => moreOpen = !moreOpen} class="flex w-full items-center justify-between px-3 py-3 text-xs text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)]">รูปแบบเพิ่มเติม <svg class="transition-transform duration-200 {moreOpen ? 'rotate-180' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6" /></svg></button>
{#if moreOpen}<div transition:slide={{ duration: 160, easing: cubicOut }}>{#each extraOptions as opt}{@render optionCard(opt)}{/each}</div>{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.notation-svg {
		width: 60px;
		min-width: 60px;
		height: 20px;
	}
</style>
