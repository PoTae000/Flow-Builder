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

		// Determine connection sides based on relative positions
		let fromSide: 'top' | 'bottom' | 'left' | 'right';
		let toSide: 'top' | 'bottom' | 'left' | 'right';

		// Choose sides based on which direction has more distance
		if (absDy > absDx) {
			// More vertical distance - use top/bottom connections
			fromSide = dy > 0 ? 'bottom' : 'top';
			toSide = dy > 0 ? 'top' : 'bottom';
		} else {
			// More horizontal distance - use left/right connections
			fromSide = dx > 0 ? 'right' : 'left';
			toSide = dx > 0 ? 'left' : 'right';
		}

		const fp = getPort(fromNode, fromSide);
		const tp = getPort(toNode, toSide);

		// Create orthogonal path with 3 segments (4 points)
		// The middle point is offset to separate parallel edges
		if (fromSide === 'top' || fromSide === 'bottom') {
			// Vertical exit: go vertical first, then horizontal, then vertical
			const midY = (fp.y + tp.y) / 2 + offset;
			return [
				fp,
				{ x: fp.x, y: midY },
				{ x: tp.x, y: midY },
				tp
			];
		} else {
			// Horizontal exit: go horizontal first, then vertical, then horizontal
			const midX = (fp.x + tp.x) / 2 + offset;
			return [
				fp,
				{ x: midX, y: fp.y },
				{ x: midX, y: tp.y },
				tp
			];
		}
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

	// Condition label position (near decision node, to the side of the edge)
	const conditionPos = $derived.by(() => {
		if (!edge.condition) return { x: 0, y: 0 };

		const start = route[0];
		const second = route[1];

		// Determine edge direction from decision node
		const isVertical = Math.abs(second.y - start.y) > Math.abs(second.x - start.x);
		const goesRight = second.x > start.x;
		const goesLeft = second.x < start.x;
		const goesDown = second.y > start.y;
		const goesUp = second.y < start.y;

		let x = start.x;
		let y = start.y;

		if (isVertical) {
			// Vertical edge: position label to the side
			if (goesDown || goesUp) {
				// Position yes to the left, no to the right
				x = edge.condition === 'yes' ? start.x - 15 : start.x + 15;
				y = (start.y + second.y) / 2;
			}
		} else {
			// Horizontal edge: position label above the line
			if (goesRight) {
				x = start.x + 20;
				y = start.y - 12;
			} else if (goesLeft) {
				x = start.x - 20;
				y = start.y - 12;
			}
		}

		return { x, y };
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

	<!-- Condition label (yes/no as simple text) -->
	{#if edge.condition}
		{@const text = edge.condition === 'yes' ? 'yes' : 'no'}
		<text
			x={conditionPos.x}
			y={conditionPos.y}
			text-anchor="middle"
			dominant-baseline="middle"
			fill={colors.relationshipText}
			font-size="11"
			font-style="italic"
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
