<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { theme } from '$lib/stores/theme.svelte';

	export interface PathData {
		id: string;
		d: string;
		particleCount: number;
		bidirectional: boolean;
		reverse?: boolean;
	}

	interface Particle {
		pathId: string;
		progress: number;
		speed: number;
		direction: 1 | -1;
		x: number;
		y: number;
		tx1: number;
		ty1: number;
		tx2: number;
		ty2: number;
		lastTick: number;
	}

	let { paths }: { paths: PathData[] } = $props();

	const particleColor = $derived(theme.isDark ? '#60a5fa' : '#3b82f6');

	let particles = $state<Particle[]>([]);
	let animFrame: number | undefined;
	let mounted = false;





	const ns = 'http://www.w3.org/2000/svg';
	let measureEls = new Map<string, SVGPathElement>();
	let measureLens = new Map<string, number>();
	let measureHost: SVGGElement | undefined = $state();


	function syncMeasureEls() {
		if (!measureHost) return;
		const liveIds = new Set(paths.map((p) => p.id));


		for (const [id, el] of measureEls) {
			if (!liveIds.has(id)) {
				el.remove();
				measureEls.delete(id);
				measureLens.delete(id);
			}
		}


		for (const pathData of paths) {
			let el = measureEls.get(pathData.id);
			if (!el) {
				el = document.createElementNS(ns, 'path');
				el.style.display = 'none';
				measureHost.appendChild(el);
				measureEls.set(pathData.id, el);
			}
			el.setAttribute('d', pathData.d);
			measureLens.set(pathData.id, el.getTotalLength());
		}
	}


	function buildParticles() {
		if (!mounted) return;
		syncMeasureEls();
		const now = performance.now();
		const newParticles: Particle[] = [];

		for (const pathData of paths) {
			if ((measureLens.get(pathData.id) ?? 0) === 0) continue;

			const specs: { count: number; direction: 1 | -1 }[] = [];
			specs.push({ count: pathData.particleCount, direction: pathData.reverse ? -1 : 1 });
			if (pathData.bidirectional) {
				specs.push({ count: pathData.particleCount, direction: -1 });
			}

			for (const spec of specs) {
				for (let i = 0; i < spec.count; i++) {
					const baseSpeed = 0.25 + Math.random() * 0.1;
					newParticles.push({
						pathId: pathData.id,
						progress: i / spec.count + Math.random() * 0.1,
						speed: baseSpeed,
						direction: spec.direction,
						x: 0, y: 0, tx1: 0, ty1: 0, tx2: 0, ty2: 0,
						lastTick: now
					});
				}
			}
		}

		particles = newParticles;
	}

	function tick() {
		const now = performance.now();

		for (const p of particles) {
			const el = measureEls.get(p.pathId);
			const len = measureLens.get(p.pathId) ?? 0;
			if (!el || len === 0) continue;

			const dt = (now - p.lastTick) / 1000;
			p.progress = ((p.progress + p.speed * p.direction * dt) % 1 + 1) % 1;
			p.lastTick = now;

			try {
				const pt = el.getPointAtLength(p.progress * len);
				p.x = pt.x;
				p.y = pt.y;

				const t1Progress = ((p.progress - 0.03 * p.direction) % 1 + 1) % 1;
				const t1 = el.getPointAtLength(t1Progress * len);
				p.tx1 = t1.x;
				p.ty1 = t1.y;

				const t2Progress = ((p.progress - 0.06 * p.direction) % 1 + 1) % 1;
				const t2 = el.getPointAtLength(t2Progress * len);
				p.tx2 = t2.x;
				p.ty2 = t2.y;
			} catch {
				// Path element may be mid-update
			}
		}

		particles = particles;
		animFrame = requestAnimationFrame(tick);
	}




	$effect(() => {

		for (const p of paths) { void p.d; }
		if (mounted) syncMeasureEls();
	});


	$effect(() => {
		const signature = paths.map((p) => `${p.id}:${p.particleCount}:${p.bidirectional}:${p.reverse}`).join('|');
		void signature;
		if (mounted) buildParticles();
	});

	onMount(() => {
		mounted = true;
		buildParticles();
		animFrame = requestAnimationFrame(tick);
	});

	onDestroy(() => {
		if (animFrame !== undefined) cancelAnimationFrame(animFrame);
		for (const el of measureEls.values()) el.remove();
		measureEls.clear();
		measureLens.clear();
		mounted = false;
	});
</script>


<g bind:this={measureHost} style="display:none;"></g>

<g class="data-flow-particles" pointer-events="none">
	{#each particles as p}
		<circle cx={p.tx2} cy={p.ty2} r="2" fill={particleColor} opacity="0.15" />
		<circle cx={p.tx1} cy={p.ty1} r="2.5" fill={particleColor} opacity="0.3" />
		<circle cx={p.x} cy={p.y} r="6" fill={particleColor} opacity="0.12" />
		<circle cx={p.x} cy={p.y} r="3.5" fill={particleColor} opacity="0.7" />
	{/each}
</g>
