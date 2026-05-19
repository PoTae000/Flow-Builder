<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { presentation } from '$lib/stores/presentation.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { onDestroy } from 'svelte';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	let currentStep = $state(0);
	let isPlaying = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;
	let speed = $state(1500);
	let animFrameId = 0;

	/** JS-based smooth pan/zoom — much lighter than CSS transition on SVG <g> */
	function smoothPanZoom(targetPanX: number, targetPanY: number, targetZoom: number) {
		cancelAnimationFrame(animFrameId);
		const startPanX = diagram.panX;
		const startPanY = diagram.panY;
		const startZoom = diagram.zoom;
		const startTime = performance.now();
		const duration = 500;

		function tick(now: number) {
			const t = Math.min(1, (now - startTime) / duration);
			const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
			diagram.panX = startPanX + (targetPanX - startPanX) * ease;
			diagram.panY = startPanY + (targetPanY - startPanY) * ease;
			diagram.zoom = startZoom + (targetZoom - startZoom) * ease;
			if (t < 1) animFrameId = requestAnimationFrame(tick);
		}
		animFrameId = requestAnimationFrame(tick);
	}

	const isCollab = $derived(collab.connected && collab.users.length > 0);
	const isPresenter = $derived(!isCollab || collab.isPresenter);
	const presenterName = $derived(
		isCollab && !collab.isPresenter
			? collab.users.find(u => u.id === collab.presenterId)?.name ?? ''
			: ''
	);

	// Build steps based on diagram type
	const steps = $derived.by(() => {
		const s: { type: 'entity' | 'relationship'; id: string; label: string; description: string }[] = [];

		if (diagram.diagramType === 'er') {
			for (const e of diagram.entities) {
				const attrs = e.attributes.map((a) => {
					const badge = a.type === 'primary_key' ? 'PK ' : a.type === 'foreign_key' ? 'FK ' : '';
					return `${badge}${a.name}`;
				}).join(', ');
				s.push({
					type: 'entity',
					id: e.id,
					label: e.name,
					description: attrs || 'ไม่มี attribute'
				});
			}

			for (const r of diagram.relationships) {
				const from = diagram.entityMap.get(r.entityIds[0])?.name || '?';
				const to = diagram.entityMap.get(r.entityIds[1])?.name || '?';
				s.push({
					type: 'relationship',
					id: r.id,
					label: r.name,
					description: `${from} [${r.cardinalities[0]}] — [${r.cardinalities[1]}] ${to}`
				});
			}
		} else if (diagram.diagramType === 'flowchart') {
			for (const node of diagram.flowNodes) {
				s.push({
					type: 'entity',
					id: node.id,
					label: node.name,
					description: `Type: ${node.type}`
				});
			}

			for (const edge of diagram.flowEdges) {
				const from = diagram.flowNodes.find(n => n.id === edge.fromNodeId)?.name || '?';
				const to = diagram.flowNodes.find(n => n.id === edge.toNodeId)?.name || '?';
				const cond = edge.condition ? ` (${edge.condition})` : '';
				s.push({
					type: 'relationship',
					id: edge.id,
					label: edge.label || 'Edge',
					description: `${from} → ${to}${cond}`
				});
			}
		} else if (diagram.diagramType === 'context') {
			for (const node of diagram.dfdNodes) {
				s.push({
					type: 'entity',
					id: node.id,
					label: node.name,
					description: `Type: ${node.type}`
				});
			}

			for (const flow of diagram.dfdFlows) {
				const from = diagram.dfdNodes.find(n => n.id === flow.fromNodeId)?.name || '?';
				const to = diagram.dfdNodes.find(n => n.id === flow.toNodeId)?.name || '?';
				s.push({
					type: 'relationship',
					id: flow.id,
					label: flow.label,
					description: `${from} → ${to}`
				});
			}
		}

		return s;
	});

	const totalSteps = $derived(steps.length);
	const currentItem = $derived(steps[currentStep] ?? null);

	// Sync step from collab (viewers receive step from presenter)
	$effect(() => {
		if (isCollab && !collab.isPresenter) {
			const remoteStep = collab.presentationStep;
			if (remoteStep !== currentStep && remoteStep >= 0 && remoteStep < steps.length) {
				currentStep = remoteStep;
			}
		}
	});

	// Auto-focus on the current step's entity/relationship
	// Uses max zoom of 1.0 (100%) to avoid zooming in too close on single entities
	$effect(() => {
		const step = steps[currentStep];
		if (!step) return;

		const cw = diagram.canvasWidth || window.innerWidth;
		const ch = diagram.canvasHeight || window.innerHeight;

		let rx: number, ry: number, rw: number, rh: number;

		if (diagram.diagramType === 'er') {
			if (step.type === 'entity') {
				const entity = diagram.entities.find(e => e.id === step.id);
				if (!entity) return;
				const box = diagram.estimateEntityBox(entity);
				rx = entity.position.x; ry = entity.position.y; rw = box.w; rh = box.h;
			} else {
				const rel = diagram.relationships.find(r => r.id === step.id);
				if (!rel) return;
				const e1 = diagram.entities.find(e => e.id === rel.entityIds[0]);
				const e2 = diagram.entities.find(e => e.id === rel.entityIds[1]);
				if (!e1 || !e2) return;
				const b1 = diagram.estimateEntityBox(e1);
				const b2 = diagram.estimateEntityBox(e2);
				rx = Math.min(e1.position.x, e2.position.x);
				ry = Math.min(e1.position.y, e2.position.y);
				rw = Math.max(e1.position.x + b1.w, e2.position.x + b2.w) - rx;
				rh = Math.max(e1.position.y + b1.h, e2.position.y + b2.h) - ry;
			}
		} else if (diagram.diagramType === 'flowchart') {
			if (step.type === 'entity') {
				const node = diagram.flowNodes.find(n => n.id === step.id);
				if (!node) return;
				const W = node.width || 140;
				const H = node.height || 60;
				rx = node.position.x - W / 2; ry = node.position.y - H / 2; rw = W; rh = H;
			} else {
				const edge = diagram.flowEdges.find(e => e.id === step.id);
				if (!edge) return;
				const n1 = diagram.flowNodes.find(n => n.id === edge.fromNodeId);
				const n2 = diagram.flowNodes.find(n => n.id === edge.toNodeId);
				if (!n1 || !n2) return;
				const W1 = n1.width || 140, H1 = n1.height || 60;
				const W2 = n2.width || 140, H2 = n2.height || 60;
				rx = Math.min(n1.position.x - W1 / 2, n2.position.x - W2 / 2);
				ry = Math.min(n1.position.y - H1 / 2, n2.position.y - H2 / 2);
				rw = Math.max(n1.position.x + W1 / 2, n2.position.x + W2 / 2) - rx;
				rh = Math.max(n1.position.y + H1 / 2, n2.position.y + H2 / 2) - ry;
			}
		} else {
			// context diagram
			if (step.type === 'entity') {
				const node = diagram.dfdNodes.find(n => n.id === step.id);
				if (!node) return;
				const W = node.type === 'external-entity' ? 80 : node.type === 'data-store' ? 140 : 120;
				const H = node.type === 'external-entity' ? 80 : node.type === 'data-store' ? 40 : 50;
				rx = node.position.x - W / 2; ry = node.position.y - H / 2; rw = W; rh = H;
			} else {
				const flow = diagram.dfdFlows.find(f => f.id === step.id);
				if (!flow) return;
				const n1 = diagram.dfdNodes.find(n => n.id === flow.fromNodeId);
				const n2 = diagram.dfdNodes.find(n => n.id === flow.toNodeId);
				if (!n1 || !n2) return;
				rx = Math.min(n1.position.x, n2.position.x) - 100;
				ry = Math.min(n1.position.y, n2.position.y) - 100;
				rw = Math.abs(n2.position.x - n1.position.x) + 200;
				rh = Math.abs(n2.position.y - n1.position.y) + 200;
			}
		}

		// Cap zoom at 1.0 so presentation never zooms in beyond 100%
		const PADDING = 120;
		const contentW = rw + PADDING * 2;
		const contentH = rh + PADDING * 2;
		const newZoom = Math.max(0.2, Math.min(1, Math.min(cw / contentW, ch / contentH)));
		const centerX = rx + rw / 2;
		const centerY = ry + rh / 2;

		// Smooth JS animation — much lighter than CSS transition on SVG <g>
		smoothPanZoom(cw / 2 - centerX * newZoom, ch / 2 - centerY * newZoom, newZoom);

		// Clear newlyRevealed after animation so elements return to normal state
		setTimeout(() => { presentation.clearNewlyRevealed(); }, 600);
	});

	// Presenter: sync pan/zoom to viewers
	$effect(() => {
		if (isCollab && collab.isPresenter) {
			collab.pushPresentationView(diagram.panX, diagram.panY, diagram.zoom);
		}
	});

	// Update the presentation store whenever step changes
	$effect(() => {
		const visEntities = new Set<string>();
		const visRels = new Set<string>();
		for (let i = 0; i <= currentStep && i < steps.length; i++) {
			const step = steps[i];
			if (step.type === 'entity') visEntities.add(step.id);
			else visRels.add(step.id);
		}

		if (diagram.diagramType === 'er') {
			// For relationships: only show if BOTH connected entities are visible
			for (const relId of visRels) {
				const rel = diagram.relationships.find((r) => r.id === relId);
				if (rel && (!visEntities.has(rel.entityIds[0]) || !visEntities.has(rel.entityIds[1]))) {
					visRels.delete(relId);
				}
			}
		} else if (diagram.diagramType === 'flowchart') {
			// For edges: only show if BOTH connected nodes are visible
			for (const edgeId of visRels) {
				const edge = diagram.flowEdges.find((e) => e.id === edgeId);
				if (edge && (!visEntities.has(edge.fromNodeId) || !visEntities.has(edge.toNodeId))) {
					visRels.delete(edgeId);
				}
			}
		} else if (diagram.diagramType === 'context') {
			// For flows: only show if BOTH connected nodes are visible
			for (const flowId of visRels) {
				const flow = diagram.dfdFlows.find((f) => f.id === flowId);
				if (flow && (!visEntities.has(flow.fromNodeId) || !visEntities.has(flow.toNodeId))) {
					visRels.delete(flowId);
				}
			}
		}

		presentation.setVisible(visEntities, visRels);
	});

	// Start presentation immediately — save current camera to restore on exit
	presentation.start(diagram.panX, diagram.panY, diagram.zoom);
	// Only push start if there's no active presenter yet (avoid stealing on rejoin/refresh)
	if (collab.connected && collab.users.length > 0 && !collab.presentationActive) {
		collab.pushPresentationStart();
	}

	function restoreCamera() {
		cancelAnimationFrame(animFrameId);
		const view = presentation.stop();
		if (view) {
			diagram.panX = view.panX;
			diagram.panY = view.panY;
			diagram.zoom = view.zoom;
		}
	}

	onDestroy(() => {
		stopPlay();
		restoreCamera();
	});

	function close() {
		stopPlay();
		restoreCamera();
		if (isCollab) {
			collab.pushPresentationStop();
		}
		onclose();
	}

	function setStep(step: number) {
		currentStep = step;
		if (isCollab) {
			collab.pushPresentationStep(step);
		}
	}

	function next() {
		if (currentStep < totalSteps - 1) setStep(currentStep + 1);
		else stopPlay();
	}

	function prev() {
		if (currentStep > 0) setStep(currentStep - 1);
	}

	function startPlay() {
		isPlaying = true;
		playInterval = setInterval(() => next(), speed);
	}

	function stopPlay() {
		isPlaying = false;
		if (playInterval) {
			clearInterval(playInterval);
			playInterval = null;
		}
	}

	function togglePlay() {
		if (isPlaying) stopPlay();
		else {
			if (currentStep >= totalSteps - 1) setStep(0);
			startPlay();
		}
	}

	function reset() {
		stopPlay();
		setStep(0);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isPresenter) return; // viewers can't control
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
		else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Touch-blocking overlay — captures stray touches so SVG canvas can't steal them on mobile -->
<div class="fixed inset-0 z-40 bg-black/10 animate-fade-in"></div>

<!-- Current step info card — top on mobile, bottom on desktop -->
<div class="fixed z-50 left-1/2 -translate-x-1/2 top-[130px] md:top-auto md:bottom-20" style="touch-action: manipulation;">
	{#if currentItem}
		<div class="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 md:px-6 md:py-3 shadow-2xl animate-scale-in">
			<div class="flex items-center gap-2 md:gap-3">
				{#if currentItem.type === 'entity'}
					<div class="flex h-7 w-7 md:h-9 md:w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
						<svg class="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /></svg>
					</div>
				{:else}
					<div class="flex h-7 w-7 md:h-9 md:w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
						<svg class="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
					</div>
				{/if}
				<div>
					<div class="text-xs md:text-sm font-medium text-[var(--ui-text)]">{currentItem.label}</div>
					<div class="text-[10px] md:text-xs text-[var(--ui-text-muted)] max-w-[200px] md:max-w-none truncate">{currentItem.description}</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Controls bar -->
<div class="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] md:bottom-4 left-1/2 z-50 -translate-x-1/2" style="touch-action: manipulation;">
	{#if isPresenter}
		<!-- Presenter controls: full control -->
		<div class="flex items-center gap-1 md:gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 md:px-4 md:py-2 shadow-2xl">
			<button onclick={close} class="rounded-full p-2 md:p-1.5 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)]" aria-label="ปิด">
				<svg class="h-5 w-5 md:h-4 md:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
			</button>

			<div class="mx-0.5 md:mx-1 h-4 w-px bg-[var(--ui-border)]"></div>

			<button onclick={reset} class="hidden md:block rounded-full p-1.5 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)]" aria-label="เริ่มใหม่">
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
			</button>

			<button onclick={() => { if (currentStep > 0) prev(); }} class="rounded-full p-2 md:p-1.5 text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] disabled:opacity-30" class:opacity-30={currentStep === 0} aria-label="ย้อน">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
			</button>

			<button onclick={togglePlay} class="flex h-10 w-10 md:h-10 md:w-10 items-center justify-center rounded-full bg-[var(--ui-accent)] text-[var(--ui-accent-text)] transition hover:opacity-90" aria-label={isPlaying ? 'หยุด' : 'เล่น'}>
				{#if isPlaying}
					<svg class="h-5 w-5 md:h-5 md:w-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
				{:else}
					<svg class="h-5 w-5 md:h-5 md:w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
				{/if}
			</button>

			<button onclick={() => { if (currentStep < totalSteps - 1) next(); }} class="rounded-full p-2 md:p-1.5 text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] disabled:opacity-30" class:opacity-30={currentStep >= totalSteps - 1} aria-label="ถัดไป">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
			</button>

			<div class="mx-0.5 md:mx-1 h-4 w-px bg-[var(--ui-border)]"></div>

			<span class="min-w-[3rem] md:min-w-[4rem] text-center text-[10px] md:text-xs text-[var(--ui-text-muted)]">
				{currentStep + 1} / {totalSteps}
			</span>

			<select
				bind:value={speed}
				onchange={() => { if (isPlaying) { stopPlay(); startPlay(); } }}
				class="hidden md:block rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-1.5 py-0.5 text-[10px] text-[var(--ui-text-muted)]"
			>
				<option value={3000}>ช้า</option>
				<option value={1500}>ปกติ</option>
				<option value={800}>เร็ว</option>
			</select>
		</div>
	{:else}
		<!-- Viewer: compact bar -->
		<div class="flex items-center gap-2 md:gap-3 rounded-full border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-1.5 md:px-5 md:py-2.5 shadow-2xl">
			<svg class="h-3.5 w-3.5 md:h-4 md:w-4 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
			<span class="text-[10px] md:text-xs text-[var(--ui-text-muted)]">
				<span class="hidden md:inline">กำลังดู </span><span class="font-medium text-[var(--ui-text)]">{presenterName}</span><span class="hidden md:inline"> นำเสนอ</span>
			</span>
			<div class="mx-0.5 md:mx-1 h-3 md:h-4 w-px bg-[var(--ui-border)]"></div>
			<span class="text-[10px] md:text-xs text-[var(--ui-text-muted)]">{currentStep + 1}/{totalSteps}</span>
		</div>
	{/if}
</div>

<!-- Progress bar -->
<div class="fixed bottom-0 left-0 right-0 z-40 h-1 bg-[var(--ui-border)]">
	<div
		class="h-full bg-[var(--ui-accent)] transition-all duration-500 ease-out"
		style="width: {totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0}%"
	></div>
</div>

<style>
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
