<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/i18n';
	import { generateId } from '$lib/utils/id';
	import { fireConfetti } from '$lib/utils/confetti';
	import type { Entity, Relationship, CardinalityType } from '$lib/types/er';

	let {
		visible = true,
		onclose,
		onopen
	}: {
		visible?: boolean;
		onclose: () => void;
		onopen: () => void;
	} = $props();

	type Phase = 'setup' | 'building' | 'grading' | 'results';
	type Difficulty = 'easy' | 'medium' | 'hard';

	let phase = $state<Phase>('setup');
	let difficulty = $state<Difficulty>('medium');
	let domain = $state('');
	let loading = $state(false);
	let error = $state('');

	// Quiz data
	let quizTitle = $state('');
	let scenario = $state('');
	let requirements = $state<string[]>([]);
	let idealSolution = $state<any>(null);
	let hints = $state<string[]>([]);
	let showHints = $state(false);

	// Timer
	let startTime = $state(0);
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	// Tab to return to after quiz
	let savedTabId = $state<string | null>(null);

	// Results
	let score = $state(0);
	let grade = $state('');
	let feedback = $state<any>(null);
	let overallComment = $state('');

	// Floating card state
	let cardCollapsed = $state(false);
	let cardScale = $state(1);
	let cardX = $state(-1); // -1 = not positioned yet
	let cardY = $state(-1);
	let cardRef: HTMLElement | undefined = $state();

	// Initialize card position from its default CSS placement
	function ensurePosition() {
		if (cardX < 0 && cardRef) {
			const rect = cardRef.getBoundingClientRect();
			cardX = rect.left;
			cardY = rect.top;
		}
	}

	// Drag to move
	let dragging = $state(false);
	let dragOffX = 0;
	let dragOffY = 0;

	function onDragStart(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button')) return;
		ensurePosition();
		dragging = true;
		dragOffX = e.clientX - cardX;
		dragOffY = e.clientY - cardY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onDragMove(e: PointerEvent) {
		if (!dragging) return;
		cardX = Math.max(0, e.clientX - dragOffX);
		cardY = Math.max(0, e.clientY - dragOffY);
	}

	function onDragEnd() {
		dragging = false;
	}

	// Resize from any corner — proportional scale
	let resizing = $state(false);
	let resizeCorner = '';
	let resizeAnchorX = 0;
	let resizeAnchorY = 0;
	let resizeStartMouseX = 0;
	let resizeStartMouseY = 0;
	let resizeStartScale = 0;
	let resizeBaseW = 0;
	let resizeBaseH = 0;

	function onCornerDown(e: PointerEvent, corner: string) {
		ensurePosition();
		resizing = true;
		resizeCorner = corner;
		resizeStartScale = cardScale;
		resizeStartMouseX = e.clientX;
		resizeStartMouseY = e.clientY;
		resizeBaseW = cardRef!.offsetWidth;
		resizeBaseH = cardRef!.offsetHeight;

		const vw = resizeBaseW * cardScale;
		const vh = resizeBaseH * cardScale;

		if (corner === 'br') { resizeAnchorX = cardX; resizeAnchorY = cardY; }
		else if (corner === 'bl') { resizeAnchorX = cardX + vw; resizeAnchorY = cardY; }
		else if (corner === 'tr') { resizeAnchorX = cardX; resizeAnchorY = cardY + vh; }
		else { resizeAnchorX = cardX + vw; resizeAnchorY = cardY + vh; }

		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
		e.stopPropagation();
	}

	function onCornerMove(e: PointerEvent) {
		if (!resizing) return;
		const origDist = Math.hypot(resizeStartMouseX - resizeAnchorX, resizeStartMouseY - resizeAnchorY);
		if (origDist < 20) return;
		const newDist = Math.hypot(e.clientX - resizeAnchorX, e.clientY - resizeAnchorY);
		const s = Math.max(0.5, Math.min(2.5, resizeStartScale * newDist / origDist));
		cardScale = s;

		const nw = resizeBaseW * s;
		const nh = resizeBaseH * s;
		if (resizeCorner === 'bl' || resizeCorner === 'tl') cardX = resizeAnchorX - nw;
		if (resizeCorner === 'tr' || resizeCorner === 'tl') cardY = resizeAnchorY - nh;
	}

	function onCornerUp() {
		resizing = false;
	}

	const cardStyle = $derived(() => {
		const parts = [`width:420px`, `transform:scale(${cardScale})`, `transform-origin:0 0`];
		if (cardX >= 0) {
			parts.push(`left:${cardX}px`, `top:${cardY}px`, 'right:auto', 'bottom:auto');
		}
		return parts.join(';');
	});

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	async function startQuiz() {
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/quiz', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ difficulty, domain: domain.trim() || undefined, diagramType: diagram.diagramType })
			});

			if (!res.ok) {
				const data: any = await res.json().catch(() => ({}));
				throw new Error(data.error || `Error: ${res.status}`);
			}

			const data: any = await res.json();
			quizTitle = data.title || (diagram.diagramType === 'context' ? 'DFD Quiz' : diagram.diagramType === 'flowchart' ? 'Flowchart Quiz' : 'ER Quiz');
			scenario = data.scenario || '';
			requirements = data.requirements || [];
			idealSolution = data.idealSolution || null;
			hints = data.hints || [];
			showHints = false;

			// Save current tab and create a new one for quiz
			savedTabId = session.activeDiagramId;
			session.createDiagram(`Quiz: ${quizTitle}`);

			// Start timer
			startTime = Date.now();
			elapsed = 0;
			timerInterval = setInterval(() => {
				elapsed = Math.floor((Date.now() - startTime) / 1000);
			}, 1000);

			phase = 'building';
			// Auto-close panel so user sees the canvas + floating card
			onclose();
		} catch (e: any) {
			error = e.message || 'Failed to generate quiz';
		} finally {
			loading = false;
		}
	}

	async function submitAnswer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		elapsed = Math.floor((Date.now() - startTime) / 1000);

		phase = 'grading';
		error = '';

		try {
			let userSolution: any;
			if (diagram.diagramType === 'context') {
				userSolution = {
					dfdNodes: $state.snapshot(diagram.dfdNodes).map(n => ({
						name: n.name, type: n.type, processNumber: n.processNumber, storeNumber: n.storeNumber
					})),
					dfdFlows: $state.snapshot(diagram.dfdFlows).map(f => {
						const from = diagram.dfdNodes.find(n => n.id === f.fromNodeId);
						const to = diagram.dfdNodes.find(n => n.id === f.toNodeId);
						return { label: f.label, fromNode: from?.name || '?', toNode: to?.name || '?' };
					})
				};
			} else if (diagram.diagramType === 'flowchart') {
				userSolution = {
					flowNodes: $state.snapshot(diagram.flowNodes).map(n => ({ name: n.name, type: n.type })),
					flowEdges: $state.snapshot(diagram.flowEdges).map(e => {
						const from = diagram.flowNodes.find(n => n.id === e.fromNodeId);
						const to = diagram.flowNodes.find(n => n.id === e.toNodeId);
						return { label: e.label, fromNode: from?.name || '?', toNode: to?.name || '?' };
					})
				};
			} else {
				userSolution = {
					entities: $state.snapshot(diagram.entities).map(e => ({
						name: e.name,
						attributes: e.attributes.map(a => {
							if (a.type === 'primary_key') return `${a.name} (PK)`;
							if (a.type === 'foreign_key') return `${a.name} (FK)`;
							return a.name;
						}),
						isWeak: e.isWeak
					})),
					relationships: $state.snapshot(diagram.relationships).map(r => {
						const fromEntity = diagram.entityMap.get(r.entityIds[0]);
						const toEntity = diagram.entityMap.get(r.entityIds[1]);
						return {
							name: r.name, from: fromEntity?.name || '?', to: toEntity?.name || '?',
							cardinalityFrom: r.cardinalities[0], cardinalityTo: r.cardinalities[1]
						};
					})
				};
			}

			const res = await fetch('/api/quiz/grade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					scenario,
					requirements,
					idealSolution,
					userSolution,
					diagramType: diagram.diagramType
				})
			});

			if (!res.ok) {
				const data: any = await res.json().catch(() => ({}));
				throw new Error(data.error || `Error: ${res.status}`);
			}

			const data: any = await res.json();
			score = data.score || 0;
			grade = data.grade || '?';
			feedback = data.feedback || {};
			overallComment = data.overallComment || '';

			phase = 'results';
			// Confetti celebration for high scores
			if (score >= 80) {
				setTimeout(() => {
					const el = cardRef || document.querySelector('.panel-slide-in');
					if (el) fireConfetti(el as HTMLElement);
				}, 300);
			}
			// Auto-open panel to show full results
			onopen();
		} catch (e: any) {
			error = e.message || 'Failed to grade';
			phase = 'building'; // Go back to building on error
		}
	}

	function showIdealSolution() {
		if (!idealSolution) return;

		diagram.entities = [];
		diagram.relationships = [];

		const entityIdMap = new Map<string, string>();
		let x = 100;
		let y = 100;

		for (const e of idealSolution.entities || []) {
			const id = generateId();
			entityIdMap.set(e.name, id);

			const attrs = (e.attributes || []).map((a: string) => {
				const isPK = a.includes('(PK)');
				const isFK = a.includes('(FK)');
				const name = a.replace(/\s*\(PK\)\s*/g, '').replace(/\s*\(FK\)\s*/g, '').trim();
				return {
					id: generateId(),
					name,
					type: isPK ? 'primary_key' : isFK ? 'foreign_key' : 'regular'
				};
			});

			diagram.entities.push({
				id,
				name: e.name,
				attributes: attrs,
				position: { x, y },
				isWeak: e.isWeak || false
			});

			x += 250;
			if (x > 800) { x = 100; y += 200; }
		}

		for (const r of idealSolution.relationships || []) {
			const fromId = entityIdMap.get(r.from);
			const toId = entityIdMap.get(r.to);
			if (fromId && toId) {
				diagram.relationships.push({
					id: generateId(),
					name: r.name,
					entityIds: [fromId, toId],
					cardinalities: [
						(r.cardinalityFrom || '1') as CardinalityType,
						(r.cardinalityTo || 'N') as CardinalityType
					],
					isIdentifying: false
				});
			}
		}

		diagram.animateLayout();
	}

	function tryAgain() {
		// Keep quiz tab as-is, go back to setup for a new round
		phase = 'setup';
		showHints = false;
		error = '';
	}

	function handleClose() {
		onclose();
	}

	function quitQuiz() {
		// Quit quiz: switch back to original tab, keep quiz tab
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		if (savedTabId && session.diagrams.some(d => d.id === savedTabId)) {
			session.switchDiagram(savedTabId);
		}
		savedTabId = null;
		phase = 'setup';
		showHints = false;
		error = '';
		onclose();
	}

	function gradeColor(g: string): string {
		switch (g) {
			case 'A': return 'text-green-500';
			case 'B': return 'text-blue-500';
			case 'C': return 'text-amber-500';
			case 'D': return 'text-orange-500';
			case 'F': return 'text-red-500';
			default: return 'text-[var(--ui-text)]';
		}
	}

	function gradeColorBg(g: string): string {
		switch (g) {
			case 'A': return 'bg-green-500';
			case 'B': return 'bg-blue-500';
			case 'C': return 'bg-amber-500';
			case 'D': return 'bg-orange-500';
			case 'F': return 'bg-red-500';
			default: return 'bg-gray-500';
		}
	}

	const difficultyConfig = {
		easy: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', label: () => i18n.t('quiz.easy') },
		medium: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', label: () => i18n.t('quiz.medium') },
		hard: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', label: () => i18n.t('quiz.hard') }
	};
</script>

<!-- ===== FLOATING CARD: shows when panel hidden + quiz active ===== -->
{#if !visible && phase !== 'setup'}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={cardRef}
	class="quiz-float fixed right-4 bottom-4 z-30 flex flex-col rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-xl animate-scale-in"
	class:select-none={dragging || resizing}
	style={cardStyle()}
>
	<!-- Card header — drag handle -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex items-center gap-2.5 px-4 py-3"
		style="cursor: grab;"
		onpointerdown={onDragStart}
		onpointermove={onDragMove}
		onpointerup={onDragEnd}
	>
		<svg class="h-4 w-4 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
		<span class="flex-1 truncate text-sm font-medium text-[var(--ui-text)]">{quizTitle}</span>

		{#if phase === 'building'}
			<span class="rounded bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-300">{formatTime(elapsed)}</span>
		{:else if phase === 'grading'}
			<svg class="h-4 w-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
		{:else if phase === 'results'}
			<span class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white {gradeColorBg(grade)}">{grade}</span>
		{/if}

		<button
			onclick={() => cardCollapsed = !cardCollapsed}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label={cardCollapsed ? 'Expand' : 'Collapse'}
		>
			<svg class="h-4 w-4 transition-transform {cardCollapsed ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
		</button>
	</div>

	<!-- Card body — collapsible -->
	{#if !cardCollapsed}
		<div class="flex-1 overflow-y-auto border-t border-[var(--ui-border)] quiz-card-body">
			{#if phase === 'building'}
				<!-- Scenario -->
				<div class="px-4 pt-3 pb-2">
					<div class="text-xs text-[var(--ui-text)] leading-relaxed">{scenario}</div>
				</div>

				<!-- Requirements -->
				<div class="px-4 pb-3">
					<ul class="space-y-1">
						{#each requirements as req, i}
							<li class="flex gap-2 text-xs text-[var(--ui-text-secondary)]">
								<span class="font-medium text-[var(--ui-text-muted)]">{i + 1}.</span>
								<span>{req}</span>
							</li>
						{/each}
					</ul>
				</div>

				<!-- Hints -->
				{#if hints.length > 0}
					{#if showHints}
						<div class="border-t border-[var(--ui-border)] px-4 py-3">
							<ul class="space-y-1">
								{#each hints as hint}
									<li class="text-xs text-amber-600 dark:text-amber-300">• {hint}</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/if}

			{:else if phase === 'grading'}
				<div class="flex items-center justify-center gap-2.5 px-4 py-6">
					<svg class="h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
					<span class="text-xs text-[var(--ui-text-muted)]">{i18n.t('quiz.grading')}</span>
				</div>

			{:else if phase === 'results'}
				<!-- Compact results -->
				<div class="px-4 pt-3 pb-2">
					<div class="flex items-center gap-3">
						<div class="text-3xl font-bold {gradeColor(grade)}">{grade}</div>
						<div>
							<div class="text-sm font-medium text-[var(--ui-text)]">{score}/100</div>
							<div class="text-xs text-[var(--ui-text-muted)]">{formatTime(elapsed)}</div>
						</div>
					</div>
				</div>
				{#if overallComment}
					<div class="px-4 pb-3 text-xs text-[var(--ui-text-secondary)] leading-relaxed">{overallComment}</div>
				{/if}
			{/if}
		</div>

		<!-- Actions footer (always at bottom) -->
		<div class="flex items-center gap-2 border-t border-[var(--ui-border)] px-4 py-2.5">
			{#if phase === 'building'}
				{#if hints.length > 0}
					<button
						onclick={() => showHints = !showHints}
						class="rounded px-2.5 py-1.5 text-xs transition {showHints ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300' : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)]'}"
					>
						{i18n.t(showHints ? 'quiz.hints' : 'quiz.showHints')}
					</button>
				{/if}
				<div class="flex-1"></div>
				<button
					onclick={quitQuiz}
					class="rounded px-2.5 py-1.5 text-xs text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				>
					{i18n.t('quiz.quit')}
				</button>
				<button
					onclick={submitAnswer}
					disabled={diagram.entities.length === 0}
					class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
				>
					{i18n.t('quiz.submit')}
				</button>
			{:else if phase === 'results'}
				<button
					onclick={onopen}
					class="rounded px-2.5 py-1.5 text-xs text-blue-500 transition hover:bg-blue-50 dark:hover:bg-blue-900/20"
				>
					{i18n.t('quiz.feedback')}
				</button>
				<div class="flex-1"></div>
				<button
					onclick={showIdealSolution}
					class="rounded px-2.5 py-1.5 text-xs text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)]"
				>
					{i18n.t('quiz.showIdeal')}
				</button>
				<button
					onclick={tryAgain}
					class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
				>
					{i18n.t('quiz.tryAgain')}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Resize handles — all 4 corners -->
	{#if !cardCollapsed}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute -top-1.5 -left-1.5 h-4 w-4 cursor-nw-resize rounded-full" style="touch-action:none"
			onpointerdown={(e) => onCornerDown(e, 'tl')} onpointermove={onCornerMove} onpointerup={onCornerUp}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute -top-1.5 -right-1.5 h-4 w-4 cursor-ne-resize rounded-full" style="touch-action:none"
			onpointerdown={(e) => onCornerDown(e, 'tr')} onpointermove={onCornerMove} onpointerup={onCornerUp}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute -bottom-1.5 -left-1.5 h-4 w-4 cursor-sw-resize rounded-full" style="touch-action:none"
			onpointerdown={(e) => onCornerDown(e, 'bl')} onpointermove={onCornerMove} onpointerup={onCornerUp}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-full" style="touch-action:none"
			onpointerdown={(e) => onCornerDown(e, 'br')} onpointermove={onCornerMove} onpointerup={onCornerUp}></div>
	{/if}
</div>
{/if}

<!-- ===== SLIDE-OVER PANEL: full detail view ===== -->
{#if visible}
<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/30 animate-fade-in"
	onclick={handleClose}
	onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }}
></div>

<!-- Slide-over panel -->
<div class="fixed right-0 top-0 z-50 flex h-full w-full md:w-[480px] md:max-w-[90vw] flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl panel-slide-in">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">{i18n.t('quiz.title')}</h2>
			{#if phase === 'building'}
				<span class="ml-2 rounded bg-[var(--ui-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--ui-text-muted)]">
					{formatTime(elapsed)}
				</span>
			{/if}
		</div>
		<button
			onclick={handleClose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="Close"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-5">
		{#if error}
			<div class="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 text-xs text-red-600 dark:text-red-400">
				{error}
			</div>
		{/if}

		<!-- Phase: Setup -->
		{#if phase === 'setup'}
			<div class="space-y-4 quiz-phase-in">
				<!-- Difficulty -->
				<div>
					<span class="mb-2 block text-xs font-medium text-[var(--ui-text-secondary)]">{i18n.t('quiz.difficulty')}</span>
					<div class="flex gap-2">
						{#each (['easy', 'medium', 'hard'] as const) as d}
							<button
								class="flex-1 rounded-lg border px-3 py-2 text-xs transition {difficulty === d
									? `${difficultyConfig[d].color} border-transparent`
									: 'border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)]'}"
								onclick={() => difficulty = d}
							>
								{difficultyConfig[d].label()}
							</button>
						{/each}
					</div>
				</div>

				<!-- Domain -->
				<div>
					<span class="mb-2 block text-xs font-medium text-[var(--ui-text-secondary)]">{i18n.t('quiz.domainHint')}</span>
					<input
						type="text"
						bind:value={domain}
						placeholder="e.g. Hospital, E-commerce, School..."
						class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] outline-none focus:border-blue-400"
					/>
				</div>

				<!-- Start button -->
				<button
					onclick={startQuiz}
					disabled={loading}
					class="w-full rounded-lg bg-blue-600 px-4 py-3 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
				>
					{#if loading}
						<span class="flex items-center justify-center gap-2">
							<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
							{i18n.t('quiz.generating')}
						</span>
					{:else}
						{i18n.t('quiz.start')}
					{/if}
				</button>
			</div>

		<!-- Phase: Building -->
		{:else if phase === 'building'}
			<div class="space-y-4 quiz-phase-in">
				<!-- Title -->
				<h3 class="text-sm font-medium text-[var(--ui-text)]">{quizTitle}</h3>

				<!-- Scenario -->
				<div>
					<span class="mb-1 block text-[10px] font-medium uppercase text-[var(--ui-text-muted)]">{i18n.t('quiz.scenario')}</span>
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-xs text-[var(--ui-text)]">
						{scenario}
					</div>
				</div>

				<!-- Requirements -->
				<div>
					<span class="mb-1 block text-[10px] font-medium uppercase text-[var(--ui-text-muted)]">{i18n.t('quiz.requirements')}</span>
					<ul class="space-y-1">
						{#each requirements as req, i}
							<li class="flex gap-2 text-xs text-[var(--ui-text-secondary)]">
								<span class="font-medium text-[var(--ui-text-muted)]">{i + 1}.</span>
								{req}
							</li>
						{/each}
					</ul>
				</div>

				<!-- Hints -->
				{#if hints.length > 0}
					<button
						onclick={() => showHints = !showHints}
						class="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
						{i18n.t(showHints ? 'quiz.hints' : 'quiz.showHints')}
					</button>

					{#if showHints}
						<div class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3">
							<ul class="space-y-1">
								{#each hints as hint}
									<li class="text-xs text-amber-700 dark:text-amber-300">• {hint}</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/if}
			</div>

		<!-- Phase: Grading -->
		{:else if phase === 'grading'}
			<div class="flex flex-col items-center gap-4 py-16 quiz-phase-in">
				<svg class="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
				<span class="text-xs text-[var(--ui-text-muted)]">{i18n.t('quiz.grading')}</span>
			</div>

		<!-- Phase: Results -->
		{:else if phase === 'results'}
			<div class="space-y-4 quiz-phase-in">
				<!-- Score -->
				<div class="flex items-center justify-center gap-4 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-6 quiz-score-reveal">
					<div class="text-center">
						<div class="text-4xl font-bold {gradeColor(grade)}">{grade}</div>
						<div class="text-xs text-[var(--ui-text-muted)]">{i18n.t('quiz.score')}: {score}/100</div>
					</div>
					<div class="h-12 w-px bg-[var(--ui-border)]"></div>
					<div class="text-center">
						<div class="text-lg font-medium text-[var(--ui-text)]">{formatTime(elapsed)}</div>
						<div class="text-xs text-[var(--ui-text-muted)]">{i18n.t('quiz.timeTaken')}</div>
					</div>
				</div>

				<!-- Overall comment -->
				{#if overallComment}
					<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 text-xs text-[var(--ui-text)]">
						{overallComment}
					</div>
				{/if}

				<!-- Feedback sections -->
				{#if feedback}
					<!-- Correct parts -->
					{#if feedback.correctParts?.length > 0}
						<div>
							<span class="mb-1 block text-xs font-medium text-green-600 dark:text-green-400">{i18n.t('quiz.correctParts')}</span>
							{#each feedback.correctParts as part}
								<div class="flex items-start gap-2 py-0.5 text-xs text-[var(--ui-text-secondary)]">
									<svg class="mt-0.5 h-3 w-3 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
									{part}
								</div>
							{/each}
						</div>
					{/if}

					<!-- Missing entities -->
					{#if feedback.missingEntities?.length > 0}
						<div>
							<span class="mb-1 block text-xs font-medium text-red-600 dark:text-red-400">{i18n.t('quiz.missingEntities')}</span>
							{#each feedback.missingEntities as item}
								<div class="py-0.5 text-xs text-[var(--ui-text-secondary)]">• {item}</div>
							{/each}
						</div>
					{/if}

					<!-- Extra entities -->
					{#if feedback.extraEntities?.length > 0}
						<div>
							<span class="mb-1 block text-xs font-medium text-amber-600 dark:text-amber-400">{i18n.t('quiz.extraEntities')}</span>
							{#each feedback.extraEntities as item}
								<div class="py-0.5 text-xs text-[var(--ui-text-secondary)]">• {item}</div>
							{/each}
						</div>
					{/if}

					<!-- Missing relationships -->
					{#if feedback.missingRelationships?.length > 0}
						<div>
							<span class="mb-1 block text-xs font-medium text-red-600 dark:text-red-400">{i18n.t('quiz.missingRels')}</span>
							{#each feedback.missingRelationships as item}
								<div class="py-0.5 text-xs text-[var(--ui-text-secondary)]">• {item}</div>
							{/each}
						</div>
					{/if}

					<!-- Wrong cardinality -->
					{#if feedback.wrongCardinality?.length > 0}
						<div>
							<span class="mb-1 block text-xs font-medium text-amber-600 dark:text-amber-400">{i18n.t('quiz.wrongCardinality')}</span>
							{#each feedback.wrongCardinality as item}
								<div class="py-0.5 text-xs text-[var(--ui-text-secondary)]">
									• {item.rel}: expected {item.expected}, got {item.got}
								</div>
							{/each}
						</div>
					{/if}

					<!-- Missing PKs -->
					{#if feedback.missingPKs?.length > 0}
						<div>
							<span class="mb-1 block text-xs font-medium text-red-600 dark:text-red-400">{i18n.t('quiz.missingPKs')}</span>
							{#each feedback.missingPKs as item}
								<div class="py-0.5 text-xs text-[var(--ui-text-secondary)]">• {item}</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Footer actions -->
	{#if phase === 'building'}
		<div class="flex gap-2 border-t border-[var(--ui-border)] px-5 py-3">
			<button
				onclick={quitQuiz}
				class="rounded border border-[var(--ui-border)] px-3 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
			>
				{i18n.t('quiz.quit')}
			</button>
			<button
				onclick={submitAnswer}
				disabled={diagram.entities.length === 0}
				class="flex-1 rounded bg-blue-600 px-3 py-2 text-xs text-white transition hover:bg-blue-700 disabled:opacity-50"
			>
				{i18n.t('quiz.submit')}
			</button>
		</div>
	{:else if phase === 'results'}
		<div class="flex gap-2 border-t border-[var(--ui-border)] px-5 py-3">
			<button
				onclick={quitQuiz}
				class="rounded border border-[var(--ui-border)] px-3 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
			>
				{i18n.t('quiz.quit')}
			</button>
			<button
				onclick={showIdealSolution}
				class="flex-1 rounded border border-[var(--ui-border)] px-3 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
			>
				{i18n.t('quiz.showIdeal')}
			</button>
			<button
				onclick={tryAgain}
				class="flex-1 rounded bg-blue-600 px-3 py-2 text-xs text-white transition hover:bg-blue-700"
			>
				{i18n.t('quiz.tryAgain')}
			</button>
		</div>
	{/if}
</div>
{/if}

<style>
	@keyframes cardBodyIn {
		from { opacity: 0; max-height: 0; }
		to { opacity: 1; max-height: 600px; }
	}
	:global(.quiz-card-body) {
		animation: cardBodyIn 0.25s ease-out;
	}

	@keyframes phaseIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
	:global(.quiz-phase-in) {
		animation: phaseIn 0.25s ease-out;
	}

	@keyframes scoreReveal {
		0% { opacity: 0; transform: scale(0.8); }
		60% { transform: scale(1.05); }
		100% { opacity: 1; transform: scale(1); }
	}
	:global(.quiz-score-reveal) {
		animation: scoreReveal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
</style>
