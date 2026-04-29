<script lang="ts">
	let { name, color, x, y, zoom }: {
		name: string;
		color: string;
		x: number;
		y: number;
		zoom: number;
	} = $props();

	const s = $derived(1 / zoom);
</script>

<g transform="translate({x}, {y})" style="transition: transform 0.1s ease-out; pointer-events: none;">
	<!-- Pointer arrow -->
	<path
		d="M0 0 L0 16 L4 12 L8 20 L11 19 L7 11 L13 11 Z"
		fill={color}
		stroke="white"
		stroke-width="1"
		transform="scale({s})"
	/>
	<!-- Name label -->
	<g transform="translate({16 * s}, {12 * s})">
		<rect
			rx={3 * s}
			width={Math.max(name.length * 7 * s + 8 * s, 24 * s)}
			height={16 * s}
			fill={color}
			opacity="0.9"
		/>
		<text
			x={4 * s}
			y={11.5 * s}
			fill="white"
			font-size={11 * s}
			font-family="'Kanit', sans-serif"
		>{name}</text>
	</g>
</g>
