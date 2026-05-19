<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { theme } from '$lib/stores/theme.svelte';

	export interface PathData {
		id: string;
		d: string;          // SVG path string
		particleCount: number;
		bidirectional: boolean;
	}

	interface Particle {
		pathId: string;
		pathEl: SVGPathElement;
		pathLen: number;
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

	function buildParticles() {
		if (!mounted) return;
		const now = performance.now();
		const newParticles: Particle[] = [];

		const ns = 'http://www.w3.org/2000/svg';
		const svg = document.querySelector('svg');
		if (!svg) return;

		for (const pathData of paths) {
			const pathEl = document.createElementNS(ns, 'path');
			pathEl.setAttribute('d', pathData.d);
			pathEl.style.display = 'none';
			svg.appendChild(pathEl);

			const pathLen = pathEl.getTotalLength();
			if (pathLen === 0) {
				svg.removeChild(pathEl);
				continue;
			}

			const specs: { count: number; direction: 1 | -1 }[] = [];

			specs.push({ count: pathData.particleCount, direction: 1 });
			if (pathData.bidirectional) {
				specs.push({ count: pathData.particleCount, direction: -1 });
			}

			for (const spec of specs) {
				for (let i = 0; i < spec.count; i++) {
					const baseSpeed = 0.25 + Math.random() * 0.1;
					newParticles.push({
						pathId: pathData.id,
						pathEl,
						pathLen,
						progress: i / spec.count + Math.random() * 0.1,
						speed: baseSpeed,
						direction: spec.direction,
						x: 0,
						y: 0,
						tx1: 0,
						ty1: 0,
						tx2: 0,
						ty2: 0,
						lastTick: now,
					});
				}
			}
		}

		// Clean up old path elements
		cleanupPathEls();
		particles = newParticles;
	}

	function cleanupPathEls() {
		// Remove old hidden path elements from DOM
		const seen = new Set<SVGPathElement>();
		for (const p of particles) {
			if (!seen.has(p.pathEl)) {
				seen.add(p.pathEl);
				p.pathEl.remove();
			}
		}
	}

	function tick() {
		const now = performance.now();

		for (const p of particles) {
			const dt = (now - p.lastTick) / 1000;
			p.progress = ((p.progress + p.speed * p.direction * dt) % 1 + 1) % 1;
			p.lastTick = now;

			try {
				const pt = p.pathEl.getPointAtLength(p.progress * p.pathLen);
				p.x = pt.x;
				p.y = pt.y;

				const t1Progress = ((p.progress - 0.03 * p.direction) % 1 + 1) % 1;
				const t1 = p.pathEl.getPointAtLength(t1Progress * p.pathLen);
				p.tx1 = t1.x;
				p.ty1 = t1.y;

				const t2Progress = ((p.progress - 0.06 * p.direction) % 1 + 1) % 1;
				const t2 = p.pathEl.getPointAtLength(t2Progress * p.pathLen);
				p.tx2 = t2.x;
				p.ty2 = t2.y;
			} catch {
				// Path element may have been removed
			}
		}

		particles = particles; // trigger reactivity
		animFrame = requestAnimationFrame(tick);
	}

	// Rebuild particles when paths change
	$effect(() => {
		void paths.length;
		// Also depend on path string changes
		for (const p of paths) {
			void p.d;
			void p.id;
		}
		if (mounted) {
			const timeout = setTimeout(() => buildParticles(), 50);
			return () => clearTimeout(timeout);
		}
	});

	onMount(() => {
		mounted = true;
		buildParticles();
		animFrame = requestAnimationFrame(tick);
	});

	onDestroy(() => {
		if (animFrame !== undefined) {
			cancelAnimationFrame(animFrame);
		}
		cleanupPathEls();
		mounted = false;
	});
</script>

<g class="data-flow-particles" pointer-events="none">
	{#each particles as p}
		<circle cx={p.tx2} cy={p.ty2} r="2" fill={particleColor} opacity="0.15" />
		<circle cx={p.tx1} cy={p.ty1} r="2.5" fill={particleColor} opacity="0.3" />
		<circle cx={p.x} cy={p.y} r="6" fill={particleColor} opacity="0.12" />
		<circle cx={p.x} cy={p.y} r="3.5" fill={particleColor} opacity="0.7" />
	{/each}
</g>
