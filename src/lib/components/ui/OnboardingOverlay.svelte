<script lang="ts">
	import { onMount } from 'svelte';
	import { i18n } from '$lib/i18n';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	let step = $state(0);
	let targetRect = $state<DOMRect | null>(null);
	let containerEl: HTMLDivElement | undefined = $state();

	// Each step targets specific UI elements with fallback selectors
	const steps: { targets: string[]; en: string; th: string }[] = [
		{
			targets: ['entity-input'],
			en: 'Type an entity name here and press "Add" to create your first entity. Entities are the tables in your database.',
			th: 'พิมพ์ชื่อ Entity ตรงนี้แล้วกด "เพิ่ม" เพื่อสร้าง Entity ตัวแรก — Entity คือตารางในฐานข้อมูลของคุณ'
		},
		{
			targets: ['notation'],
			en: 'Choose your notation style here: Crow\'s Foot (IE), Chen, UML, and 5 more.',
			th: 'เลือกรูปแบบ Notation ตรงนี้: Crow\'s Foot (IE), Chen, UML และอื่นๆ อีก 5 แบบ'
		},
		{
			targets: ['canvas'],
			en: 'This is your canvas. Drag entities to move them. Scroll to zoom. Right-click drag to select multiple.',
			th: 'นี่คือ Canvas ลาก Entity เพื่อย้าย, เลื่อน scroll เพื่อซูม, คลิกขวาลากเพื่อเลือกหลายตัว'
		},
		{
			targets: ['add-rel'],
			en: 'After creating 2+ entities, click here to add a relationship between them.',
			th: 'หลังสร้าง Entity 2 ตัวขึ้นไป กดตรงนี้เพื่อเพิ่มความสัมพันธ์ระหว่าง Entity'
		},
		{
			targets: ['toolbar'],
			en: 'All tools are here: Undo/Redo, AI Analyze, Translate, Export, Generate Code, and more in the "..." menu.',
			th: 'เครื่องมือทั้งหมดอยู่ตรงนี้: Undo/Redo, AI วิเคราะห์, แปลภาษา, Export, Generate Code และอื่นๆ ในเมนู "..."'
		},
		{
			targets: [],
			en: 'You\'re all set! Press ? to see keyboard shortcuts. Try Ctrl+D to duplicate, Ctrl+F to search.',
			th: 'พร้อมแล้ว! กด ? เพื่อดู Keyboard Shortcuts ลอง Ctrl+D เพื่อ Duplicate, Ctrl+F เพื่อค้นหา'
		}
	];

	function findVisibleElement(selectors: string[]): Element | null {
		for (const sel of selectors) {
			const el = document.querySelector(`[data-onboarding="${sel}"]`);
			if (!el) continue;
			const rect = el.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0) return el;
		}
		return null;
	}

	function updateTargetRect() {
		const s = steps[step];
		if (!s || s.targets.length === 0) {
			targetRect = null;
			return;
		}
		const el = findVisibleElement(s.targets);
		targetRect = el ? el.getBoundingClientRect() : null;
	}

	function next() {
		if (step < steps.length - 1) {
			step++;
			updateTargetRect();
		} else {
			onclose();
		}
	}

	function prev() {
		if (step > 0) {
			step--;
			updateTargetRect();
		}
	}

	function skip() {
		onclose();
	}

	onMount(() => {
		updateTargetRect();
		// Auto-focus container so keyboard arrows work immediately
		requestAnimationFrame(() => containerEl?.focus());
		const resizeHandler = () => updateTargetRect();
		window.addEventListener('resize', resizeHandler);
		return () => window.removeEventListener('resize', resizeHandler);
	});

	// Smart tooltip positioning
	let tooltipStyle = $derived.by(() => {
		if (!targetRect) {
			return 'left: 50%; top: 50%; transform: translate(-50%, -50%);';
		}

		const tooltipW = 320;
		const tooltipH = 120;
		const gap = 16;
		const winW = window.innerWidth;
		const winH = window.innerHeight;

		let x: number;
		let y: number;

		// For very large elements (like canvas covering most of the screen), center tooltip
		if (targetRect.width > winW * 0.5 && targetRect.height > winH * 0.5) {
			x = targetRect.left + targetRect.width / 2 - tooltipW / 2;
			y = targetRect.top + targetRect.height / 2 - tooltipH / 2;
		}
		// For tall elements (like sidebar), place to the right
		else if (targetRect.height > winH * 0.4) {
			x = targetRect.right + gap;
			y = targetRect.top + 60;
			if (x + tooltipW > winW) {
				x = targetRect.left - gap - tooltipW;
			}
		}
		// For wide elements (like toolbar), place below
		else if (targetRect.width > winW * 0.3) {
			x = targetRect.left + targetRect.width / 2 - tooltipW / 2;
			y = targetRect.bottom + gap;
			if (y + tooltipH > winH) {
				y = targetRect.top - gap - tooltipH;
			}
		}
		// Default: below and centered
		else {
			x = targetRect.left + targetRect.width / 2 - tooltipW / 2;
			y = targetRect.bottom + gap;
			if (y + tooltipH > winH) {
				y = targetRect.top - gap - tooltipH;
			}
		}

		// Clamp to viewport
		x = Math.max(12, Math.min(x, winW - tooltipW - 12));
		y = Math.max(12, Math.min(y, winH - tooltipH - 12));

		return `left: ${x}px; top: ${y}px;`;
	});

	// Spotlight clip-path
	let clipPath = $derived.by(() => {
		if (!targetRect) return 'none';
		const pad = 8;
		const l = targetRect.left - pad;
		const t = targetRect.top - pad;
		const r = targetRect.right + pad;
		const b = targetRect.bottom + pad;
		const rad = 12;
		return `polygon(
			0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
			${l}px ${t + rad}px,
			${l + rad}px ${t}px,
			${r - rad}px ${t}px,
			${r}px ${t + rad}px,
			${r}px ${b - rad}px,
			${r - rad}px ${b}px,
			${l + rad}px ${b}px,
			${l}px ${b - rad}px,
			${l}px ${t + rad}px
		)`;
	});

	function getMessage(): string {
		const s = steps[step];
		if (!s) return '';
		return i18n.isEn ? s.en : s.th;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div bind:this={containerEl} class="fixed inset-0 z-[60] animate-fade-in" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') skip(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); }}>
	<!-- Dark overlay with spotlight — clicking dark area advances -->
	<div
		class="absolute inset-0 bg-black/50 transition-all duration-300"
		style:clip-path={clipPath}
		onclick={next}
	></div>

	<!-- Tooltip card -->
	<div
		class="absolute z-10 w-80 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-5 shadow-2xl animate-scale-in"
		style={tooltipStyle}
	>
		<!-- Step counter -->
		<div class="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--ui-text-muted)]">
			Step {step + 1} / {steps.length}
		</div>

		<p class="text-sm leading-relaxed text-[var(--ui-text)] mb-4">{getMessage()}</p>

		<!-- Step dots + buttons -->
		<div class="flex items-center justify-between">
			<div class="flex gap-1.5">
				{#each steps as _, i}
					<div class="h-2 w-2 rounded-full transition-all {i === step ? 'bg-[var(--ui-accent)] scale-125' : i < step ? 'bg-[var(--ui-accent)]/40' : 'bg-[var(--ui-border)]'}"></div>
				{/each}
			</div>

			<div class="flex items-center gap-2">
				<button
					onclick={skip}
					class="rounded px-3 py-1.5 text-xs text-[var(--ui-text-muted)] transition hover:text-[var(--ui-text)]"
				>
					{i18n.isEn ? 'Skip' : 'ข้าม'}
				</button>
				{#if step > 0}
					<button
						onclick={prev}
						class="rounded-lg border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
					>
						{i18n.isEn ? 'Back' : 'ย้อน'}
					</button>
				{/if}
				<button
					onclick={next}
					class="rounded-lg bg-[var(--ui-accent)] px-4 py-1.5 text-xs font-medium text-[var(--ui-accent-text)] transition hover:opacity-90"
				>
					{step < steps.length - 1 ? (i18n.isEn ? 'Next' : 'ถัดไป') : (i18n.isEn ? 'Start!' : 'เริ่มเลย!')}
				</button>
			</div>
		</div>
	</div>
</div>
