<script lang="ts">



	let { d, t, color = '#22c55e', strokeWidth = 1.5 }: { d: string; t: number; color?: string; strokeWidth?: number } = $props();

	let pathEl = $state<SVGPathElement | null>(null);

	const point = $derived.by(() => {
		if (!pathEl || !d) return null;
		try {
			const len = pathEl.getTotalLength();
			if (!len) return null;
			return pathEl.getPointAtLength(Math.min(1, Math.max(0, t)) * len);
		} catch {
			return null;
		}
	});
</script>


<path bind:this={pathEl} {d} fill="none" stroke="none" style="pointer-events:none" />
<path {d} fill="none" stroke={color} stroke-width={strokeWidth} pathLength="1" stroke-dasharray={`${Math.min(1, Math.max(0, t))} 1`} style="pointer-events:none" />

{#if point}
	<g class="sim-token" style="pointer-events:none">
		<circle cx={point.x} cy={point.y} r="9" fill={color} opacity="0.18" />
		<circle cx={point.x} cy={point.y} r="5" fill={color} opacity="0.35" />
		<circle cx={point.x} cy={point.y} r="3" fill={color}>
			<animate attributeName="r" values="3;3.6;3" dur="0.6s" repeatCount="indefinite" />
		</circle>
	</g>
{/if}
