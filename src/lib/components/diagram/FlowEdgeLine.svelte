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

		// Determine connection sides based on flowchart conventions:
		// - Decision nodes can only exit from left, right, or bottom (NOT top)
		// - Prefer top-to-bottom flow (arrow points down)
		// - Use left-to-right for horizontal flow (arrow points right)

		let fromSide: 'top' | 'bottom' | 'left' | 'right';
		let toSide: 'top' | 'bottom' | 'left' | 'right';

		const isFromDecision = fromNode.type === 'decision';
		const isToDecision = toNode.type === 'decision';
		const isLoop = dy < -NODE_H;

		if (isLoop && !isFromDecision) {
			// Loop: route around the side (only for non-decision nodes)
			const useRight = dx >= 0;
			fromSide = useRight ? 'right' : 'left';
			toSide = useRight ? 'right' : 'left';

			const fp = getPort(fromNode, fromSide);
			const tp = getPort(toNode, toSide);
			const sideX = (useRight ? Math.max(fp.x, tp.x) : Math.min(fp.x, tp.x)) + (useRight ? LOOP_OFFSET : -LOOP_OFFSET) + offset;

			return [
				fp,
				{ x: sideX, y: fp.y },
				{ x: sideX, y: tp.y },
				tp
			];
		}

		// Determine fromSide (where edge exits)
		if (isFromDecision) {
			// Decision nodes: only exit from left, right, or bottom
			if (absDx > 30) {
				fromSide = dx > 0 ? 'right' : 'left';
			} else {
				fromSide = 'bottom';
			}
		} else {
			// Normal nodes: prefer downward flow
			if (dy > 0) {
				fromSide = 'bottom';
			} else if (dy < 0) {
				fromSide = 'top';
			} else {
				fromSide = dx > 0 ? 'right' : 'left';
			}
		}

		// Determine toSide (where edge enters)
		if (isToDecision) {
			// Decision nodes: ONLY receive from top (never from bottom/left/right)
			toSide = 'top';
		} else {
			// Normal nodes: enter from appropriate side
			if (dy > 0) {
				toSide = 'top';
			} else if (dy < 0) {
				toSide = 'bottom';
			} else {
				toSide = dx > 0 ? 'left' : 'right';
			}
		}

		const fp = getPort(fromNode, fromSide);
		const tp = getPort(toNode, toSide);

		// For decision nodes exiting from sides: turn down quickly
		if (isFromDecision && (fromSide === 'left' || fromSide === 'right')) {
			// Exit from decision side: go horizontal briefly, then turn DOWN
			const exitDistance = 60; // Short horizontal distance before turning
			const turnX = fromSide === 'right' ? fp.x + exitDistance : fp.x - exitDistance;
			const midY = Math.max(fp.y, tp.y) + 40; // Go down below both nodes

			return [
				fp,
				{ x: turnX + offset, y: fp.y },        // Short horizontal exit
				{ x: turnX + offset, y: midY },        // Turn down (arrow points DOWN)
				{ x: tp.x, y: midY },                  // Route to target x
				tp                                      // Final approach to target
			];
		}

		// Normal routing for other cases
		const midY = (fp.y + tp.y) / 2;
		const midX = (fp.x + tp.x) / 2;

		if (fromSide === 'top' || fromSide === 'bottom') {
			// Vertical start: go vertical, then horizontal, then vertical
			return [
				fp,
				{ x: fp.x, y: midY + offset },
				{ x: tp.x, y: midY + offset },
				tp
			];
		} else {
			// Horizontal start: go horizontal, then vertical, then horizontal
			return [
				fp,
				{ x: midX + offset, y: fp.y },
				{ x: midX + offset, y: tp.y },
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

	// Condition label position (beside the edge line, not on top of it)
	const conditionPos = $derived.by(() => {
		const pts = route;
		let centerX: number, centerY: number;

		if (pts.length === 2) {
			centerX = (pts[0].x + pts[1].x) / 2;
			centerY = (pts[0].y + pts[1].y) / 2;
		} else {
			// Position at the middle of the path
			const mi = Math.floor(pts.length / 2);
			centerX = (pts[mi - 1].x + pts[mi].x) / 2;
			centerY = (pts[mi - 1].y + pts[mi].y) / 2;
		}

		// Determine if the middle segment is vertical or horizontal
		const mi = Math.floor(pts.length / 2);
		const isVertical = pts[mi - 1] && pts[mi] && Math.abs(pts[mi].y - pts[mi - 1].y) > Math.abs(pts[mi].x - pts[mi - 1].x);

		// Offset label to the side of the line
		if (isVertical) {
			// Vertical line: position yes to the left, no to the right
			return {
				x: centerX + (edge.condition === 'yes' ? -18 : 18),
				y: centerY
			};
		} else {
			// Horizontal line: position above the line
			return {
				x: centerX,
				y: centerY - 12
			};
		}
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

	<!-- Label (only show if no condition label) -->
	{#if edge.label && !edge.condition}
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
