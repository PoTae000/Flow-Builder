<script lang="ts">
	import type { FlowEdge } from '$lib/types/flowchart';
	import type { FlowNode } from '$lib/types/flowchart';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		edge,
		fromNode,
		toNode,
		offset = 0,
		selected = false,
		onclick
	}: {
		edge: FlowEdge;
		fromNode: FlowNode;
		toNode: FlowNode;
		offset?: number;
		selected?: boolean;
		onclick?: () => void;
	} = $props();

	const colors = $derived(theme.colors);

	const NODE_W = 140;
	const NODE_H = 60;

	function getPort(node: FlowNode, side: 'top' | 'bottom' | 'left' | 'right') {
		const { x: cx, y: cy } = node.position;
		if (node.type === 'decision') {
			const hw = NODE_W / 2 + 10, hh = NODE_H / 2 + 5;
			if (side === 'top') return { x: cx, y: cy - hh };
			if (side === 'bottom') return { x: cx, y: cy + hh };
			if (side === 'left') return { x: cx - hw, y: cy };
			return { x: cx + hw, y: cy };
		}
		if (node.type === 'connector') {
			const r = 25;
			if (side === 'top') return { x: cx, y: cy - r };
			if (side === 'bottom') return { x: cx, y: cy + r };
			if (side === 'left') return { x: cx - r, y: cy };
			return { x: cx + r, y: cy };
		}
		const hw = NODE_W / 2, hh = NODE_H / 2;
		if (side === 'top') return { x: cx, y: cy - hh };
		if (side === 'bottom') return { x: cx, y: cy + hh };
		if (side === 'left') return { x: cx - hw, y: cy };
		return { x: cx + hw, y: cy };
	}

	const LOOP_OFFSET = 40;

	const route = $derived.by(() => {
		const dx = toNode.position.x - fromNode.position.x;
		const dy = toNode.position.y - fromNode.position.y;
		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);

		// Loop-back detection: edge goes upward while nodes are horizontally close
		// Route around the right side in a "C" shape to avoid crossing nodes in between
		if (dy < -NODE_H && absDx < NODE_W * 1.5) {
			const fp = getPort(fromNode, 'right');
			const tp = getPort(toNode, 'right');
			const loopX = Math.max(fp.x, tp.x) + LOOP_OFFSET + offset;
			return [fp, { x: loopX, y: fp.y }, { x: loopX, y: tp.y }, tp];
		}

		let fromSide: 'top' | 'bottom' | 'left' | 'right';
		let toSide: 'top' | 'bottom' | 'left' | 'right';

		if (absDy >= absDx) {
			if (dy > 0) { fromSide = 'bottom'; toSide = 'top'; }
			else { fromSide = 'top'; toSide = 'bottom'; }
		} else {
			if (dx > 0) { fromSide = 'right'; toSide = 'left'; }
			else { fromSide = 'left'; toSide = 'right'; }
		}

		const fp = getPort(fromNode, fromSide);
		const tp = getPort(toNode, toSide);

		let pts: { x: number; y: number }[];

		if (fromSide === 'bottom' || fromSide === 'top') {
			const midY = (fp.y + tp.y) / 2;
			if (fp.x === tp.x) {
				// Straight vertical line - offset horizontally
				pts = [fp, tp].map(p => ({ x: p.x + offset, y: p.y }));
			} else {
				// Orthogonal path - offset the middle horizontal segment
				pts = [
					fp,
					{ x: fp.x + offset, y: midY },
					{ x: tp.x + offset, y: midY },
					tp
				];
			}
		} else {
			const midX = (fp.x + tp.x) / 2;
			if (fp.y === tp.y) {
				// Straight horizontal line - offset vertically
				pts = [fp, tp].map(p => ({ x: p.x, y: p.y + offset }));
			} else {
				// Orthogonal path - offset the middle vertical segment
				pts = [
					fp,
					{ x: midX, y: fp.y + offset },
					{ x: midX, y: tp.y + offset },
					tp
				];
			}
		}

		return pts;
	});

	const pathD = $derived(
		route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
	);

	// Label at center of path
	const labelPos = $derived.by(() => {
		const pts = route;
		if (pts.length === 2) {
			return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
		}
		const mi = Math.floor(pts.length / 2);
		return { x: (pts[mi - 1].x + pts[mi].x) / 2, y: (pts[mi - 1].y + pts[mi].y) / 2 };
	});

	// Condition badge near fromNode (on first segment)
	const badgePos = $derived({
		x: (route[0].x + route[1].x) / 2,
		y: (route[0].y + route[1].y) / 2
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<g
	class="flow-edge"
	class:selected
	{onclick}
	style="cursor: pointer;"
>
	<!-- Hit area -->
	<path
		d={pathD}
		stroke="transparent"
		stroke-width="12"
		fill="none"
	/>

	<!-- Visible line -->
	<path
		d={pathD}
		stroke={selected ? colors.selectedStroke : colors.relationshipStroke}
		stroke-width={selected ? 2 : 1.5}
		fill="none"
		marker-end="url(#flow-arrow)"
	/>

	<!-- Condition badge (Yes/No) -->
	{#if edge.condition}
		{@const text = edge.condition === 'yes' ? 'Yes' : 'No'}
		{@const badgeFill = edge.condition === 'yes' ? '#059669' : '#dc2626'}
		<rect
			x={badgePos.x - 14}
			y={badgePos.y - 9}
			width={28}
			height={18}
			rx="4"
			fill={badgeFill}
			opacity="0.9"
		/>
		<text
			x={badgePos.x}
			y={badgePos.y}
			text-anchor="middle"
			dominant-baseline="central"
			fill="white"
			font-size="10"
			font-weight="600"
		>
			{text}
		</text>
	{/if}

	<!-- Label -->
	{#if edge.label}
		<rect
			x={labelPos.x - edge.label.length * 3.5 - 4}
			y={labelPos.y - 10}
			width={edge.label.length * 7 + 8}
			height={20}
			fill={colors.entityFill}
			rx="3"
		/>
		<text
			x={labelPos.x}
			y={labelPos.y}
			text-anchor="middle"
			dominant-baseline="central"
			fill={colors.relationshipText}
			font-size="11"
		>
			{edge.label}
		</text>
	{/if}
</g>
