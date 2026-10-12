<script lang="ts">
	let { value }: { value: number } = $props();
	// svelte-ignore state_referenced_locally — intentional: $effect handles reactive updates
	let displayed = $state(value);
	let rafId = 0;

	$effect(() => {
		const target = value;
		const start = displayed;
		if (start === target) return;
		const startTime = performance.now();
		const duration = 300;
		cancelAnimationFrame(rafId);
		function tick(now: number) {
			const t = Math.min((now - startTime) / duration, 1);
			const eased = 1 - (1 - t) ** 3;
			displayed = Math.round(start + (target - start) * eased);
			if (t < 1) rafId = requestAnimationFrame(tick);
		}
		rafId = requestAnimationFrame(tick);
	});
</script>

<span class="tabular-nums">{displayed}</span>
