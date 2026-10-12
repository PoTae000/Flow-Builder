<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { theme } from '$lib/stores/theme.svelte';
	let { label = 'รูปแบบ ER' }: { label?: string } = $props();
	let open = $state(false);
	const options = [
		{ value: 'standard', label: 'มาตรฐาน', description: 'เส้นเรียบ ใช้สีตามธีมแผนภาพ', colors: ['#87909b', '#87909b', '#87909b'] },
		{ value: 'pastel', label: 'พาสเทล', description: 'สีอ่อนหลากหลาย แยก Entity ได้ง่าย', colors: ['#e9a5cd', '#a6baf0', '#9edac1'] },
		{ value: 'ocean', label: 'โอเชียน', description: 'โทนฟ้า น้ำเงิน และทะเล', colors: ['#38bdf8', '#818cf8', '#2dd4bf'] },
		{ value: 'sunset', label: 'ซันเซ็ต', description: 'โทนส้ม ชมพู และม่วง', colors: ['#fb923c', '#f472b6', '#c084fc'] },
		{ value: 'forest', label: 'ฟอเรสต์', description: 'โทนเขียว มิ้นต์ และธรรมชาติ', colors: ['#4ade80', '#2dd4bf', '#a3e635'] },
		{ value: 'mono', label: 'มินิมอล', description: 'โทนเทา เรียบและอ่านง่าย', colors: ['#94a3b8', '#a1a1aa', '#9ca3af'] }
	];
	const selected = $derived(options.find(option => option.value === theme.erPreset) ?? options[0]);
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') open = false; }} />
<div class="flex flex-col gap-1.5" role="group" aria-label={label}>
	<span class="text-xs font-normal uppercase tracking-wider text-[var(--ui-text-muted)]">{label}</span>
	<button type="button" aria-expanded={open} class="flex w-full items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm font-light text-[var(--ui-text)] shadow-sm transition hover:border-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-2 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none" onclick={() => open = !open}>
		<span class="flex-1 truncate text-left">{selected.label}</span>
		<svg class="h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)] transition-transform duration-150 {open ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" /></svg>
	</button>
	{#if open}
		<div transition:slide={{ duration: 160, easing: cubicOut }} class="flex flex-col overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)]">
			<div class="flex items-center gap-2 border-b border-[var(--ui-border-light)] px-3 py-2">
				<span class="text-xs font-medium text-[var(--ui-text)]">เลือก{label}</span>
				<button type="button" aria-label="ปิดตัวเลือกรูปแบบ ER" onclick={() => open = false} class="ml-auto rounded p-0.5 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
			</div>
			<div class="max-h-72 overflow-y-auto">
				{#each options as option}
					<button type="button" aria-pressed={theme.erPreset === option.value} onclick={() => { theme.setERPreset(option.value); open = false; }} class="flex w-full flex-col gap-1.5 border-b border-[var(--ui-border-light)] px-3 py-3 text-left transition last:border-b-0 {theme.erPreset === option.value ? 'bg-[var(--ui-bg-tertiary)]' : 'hover:bg-[var(--ui-hover)]'}">
						<div class="flex w-full items-center gap-2.5">
							<svg width="60" height="20" viewBox="0 0 60 24" class="shrink-0" aria-hidden="true">
								{#each option.colors as color, index}
									<rect x={index * 21} y="2" width="17" height="20" rx="1" fill={color} fill-opacity="0.1" stroke={color}/>
									<rect x={index * 21} y="2" width="17" height="6" fill={color} fill-opacity="0.4"/>
									<path d="M{index * 21 + 4} 12h9m-9 5h6" stroke={color} stroke-width="1"/>
								{/each}
							</svg>
							<span class="min-w-0 flex-1 truncate text-sm font-light text-[var(--ui-text)]">{option.label}</span>
							{#if theme.erPreset === option.value}<svg class="h-3.5 w-3.5 shrink-0 text-[var(--ui-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>{/if}
						</div>
						<p class="text-[11px] leading-relaxed text-[var(--ui-text-muted)]">{option.description}</p>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
