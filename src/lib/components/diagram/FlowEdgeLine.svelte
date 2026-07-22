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
		dying = false,
		onclick,
		onlinemousedown
	}: {
		edge: FlowEdge;
		fromNode: FlowNode;
		toNode: FlowNode;
		offset?: number;
		selected?: boolean;
		dying?: boolean;
		onclick?: () => void;
		onlinemousedown?: (e: MouseEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);

	const lineStyle = $derived(edge.lineStyle || 'orthogonal');
	const strokeWidth = $derived(edge.strokeWidth || 1.5);
	const strokeDash = $derived(edge.strokeDash || 'solid');
	const edgeColor = $derived(edge.edgeColor || colors.relationshipStroke);

	const dashArray = $derived(() => {
		if (strokeDash === 'dashed') return '8 4';
		if (strokeDash === 'dotted') return '2 2';
		return '0';
	});

	function getPort(node: FlowNode, side: 'top' | 'bottom' | 'left' | 'right') {
		const { x: cx, y: cy } = node.position;
		const W = node.width || 140;
		const H = node.height || 60;

		if (node.type === 'decision') {
			const hw = W / 2 + 10, hh = H / 2 + 5;
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
		const hw = W / 2, hh = H / 2;
		if (side === 'top') return { x: cx, y: cy - hh };
		if (side === 'bottom') return { x: cx, y: cy + hh };
		if (side === 'left') return { x: cx - hw, y: cy };
		return { x: cx + hw, y: cy };
	}

	const LOOP_OFFSET = 40;

	function getFromSide(): 'top' | 'bottom' | 'left' | 'right' {
		const dx = toNode.position.x - fromNode.position.x;
		const dy = toNode.position.y - fromNode.position.y;
		if (fromNode.type === 'decision') {
			return Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx > 0 ? 'right' : 'left') : 'bottom';
		}
		return dy >= 0 ? 'bottom' : 'top';
	}

	function getToSide(): 'top' | 'bottom' | 'left' | 'right' {
		const dy = toNode.position.y - fromNode.position.y;
		return toNode.type === 'decision' ? 'top' : (dy >= 0 ? 'top' : 'bottom');
	}

	const route = $derived.by(() => {
		const fromSide = getFromSide();
		const toSide = getToSide();
		const fp = getPort(fromNode, fromSide);
		const tp = getPort(toNode, toSide);

		// Single waypoint: use as corridor position for 4-point orthogonal path
		if (edge.waypoints && edge.waypoints.length === 1) {
			const wp = edge.waypoints[0];
			if (fromSide === 'top' || fromSide === 'bottom') {
				return [fp, { x: fp.x, y: wp.y }, { x: tp.x, y: wp.y }, tp];
			}
			return [fp, { x: wp.x, y: fp.y }, { x: wp.x, y: tp.y }, tp];
		}

		// 2+ waypoints: straight-through (backward compatible)
		if (edge.waypoints && edge.waypoints.length > 1) {
			return [fp, ...edge.waypoints, tp];
		}

		// No waypoints: default orthogonal routing
		const midY = (fp.y + tp.y) / 2 + offset;
		return [fp, { x: fp.x, y: midY }, { x: tp.x, y: midY }, tp];
	});

	const pathD = $derived.by(() => {
		if (lineStyle === 'straight') {
			// Direct line from start to end
			return `M${route[0].x},${route[0].y} L${route[route.length - 1].x},${route[route.length - 1].y}`;
		} else if (lineStyle === 'curved') {
			// Smooth bezier curve through waypoints
			if (route.length === 2) {
				return `M${route[0].x},${route[0].y} L${route[1].x},${route[1].y}`;
			}

			let d = `M${route[0].x},${route[0].y}`;
			for (let i = 0; i < route.length - 1; i++) {
				const p1 = route[i];
				const p2 = route[i + 1];

				if (i === 0) {
					// First segment - control point biased toward start
					const cp1x = p1.x + (p2.x - p1.x) * 0.5;
					const cp1y = p1.y;
					const cp2x = p2.x;
					const cp2y = p1.y + (p2.y - p1.y) * 0.5;
					d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
				} else {
					// Smooth curve segments
					const cp1x = p1.x;
					const cp1y = p1.y + (p2.y - p1.y) * 0.5;
					const cp2x = p2.x;
					const cp2y = p1.y + (p2.y - p1.y) * 0.5;
					d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
				}
			}
			return d;
		} else {
			// Orthogonal (default)
			return route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
		}
	});

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
	class:dying
	{onclick}
	style="cursor: pointer;"
>
	<!-- Hit area -->
	<path
		d={pathD}
		stroke="transparent"
		stroke-width="12"
		fill="none"
		onmousedown={(e) => { if (onlinemousedown && e.button === 0) { e.stopPropagation(); onlinemousedown(e); } }}
	/>

	<!-- Visible line -->
	<path
		d={pathD}
		stroke={selected ? colors.selectedStroke : edgeColor}
		stroke-width={selected ? strokeWidth + 0.5 : strokeWidth}
		stroke-dasharray={dashArray()}
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

<style>
	@keyframes edgeFadeOut {
		0%   { opacity: 1; }
		100% { opacity: 0; }
	}
	.flow-edge.dying {
		animation: edgeFadeOut 0.5s ease-in forwards;
		pointer-events: none;
	}
</style>
