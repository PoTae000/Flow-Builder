<script lang="ts">
	import type { DFDFlow } from '$lib/types/context-diagram';
	import type { DFDNode } from '$lib/types/context-diagram';
	import type { Position } from '$lib/types/geometry';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		flow,
		fromNode,
		toNode,
		selected = false,
		animateIn = false,
		dying = false,
		onclick
	}: {
		flow: DFDFlow;
		fromNode: DFDNode;
		toNode: DFDNode;
		selected?: boolean;
		animateIn?: boolean;
		dying?: boolean;
		onclick?: () => void;
	} = $props();

	const colors = $derived(theme.colors);

	// Get node bounding box based on type
	function getNodeRect(node: DFDNode): { x: number; y: number; w: number; h: number } {
		const cx = node.position.x;
		const cy = node.position.y;
		if (node.type === 'process') {
			const w = 140;
			const headerH = node.processNumber ? 28 : 0;
			const bodyH = 50;
			const h = headerH + bodyH;
			return { x: cx - w / 2, y: cy - h / 2, w, h };
		} else if (node.type === 'external-entity') {
			const w = 120, h = 50;
			return { x: cx - w / 2, y: cy - h / 2, w, h };
		} else {
			// data-store
			const w = 140, h = 40;
			return { x: cx - w / 2, y: cy - h / 2, w, h };
		}
	}

	// Get the port position on the edge of the node closest to a target point
	function getPortToward(node: DFDNode, target: Position): Position {
		const rect = getNodeRect(node);
		const cx = node.position.x;
		const cy = node.position.y;
		const tx = target.x;
		const ty = target.y;
		const dx = tx - cx;
		const dy = ty - cy;

		// For data-store, only allow top/bottom exits
		if (node.type === 'data-store') {
			const portX = Math.max(rect.x + 8, Math.min(rect.x + rect.w - 8, tx));
			return dy >= 0
				? { x: portX, y: rect.y + rect.h }
				: { x: portX, y: rect.y };
		}

		// Determine which side to exit from based on direction to target
		if (Math.abs(dx) > Math.abs(dy)) {
			// Horizontal exit
			const portY = Math.max(rect.y + 8, Math.min(rect.y + rect.h - 8, ty));
			return dx > 0
				? { x: rect.x + rect.w, y: portY }
				: { x: rect.x, y: portY };
		} else {
			// Vertical exit
			const portX = Math.max(rect.x + 8, Math.min(rect.x + rect.w - 8, tx));
			return dy > 0
				? { x: portX, y: rect.y + rect.h }
				: { x: portX, y: rect.y };
		}
	}

	// Fallback auto-routing (4-point orthogonal path when no waypoints)
	function autoRoute(): Position[] {
		const fromRect = getNodeRect(fromNode);
		const toRect = getNodeRect(toNode);
		const fcx = fromNode.position.x, fcy = fromNode.position.y;
		const tcx = toNode.position.x, tcy = toNode.position.y;

		type Dir = 'top' | 'bottom' | 'left' | 'right';

		function naturalDir(fromCx: number, fromCy: number, toCx: number, toCy: number, nodeType: string): Dir {
			const dx = toCx - fromCx, dy = toCy - fromCy;
			if (nodeType === 'data-store') return dy >= 0 ? 'bottom' : 'top';
			if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
			return dy > 0 ? 'bottom' : 'top';
		}

		function getPortPos(dir: Dir, rect: { x: number; y: number; w: number; h: number }, cx: number, cy: number): Position {
			switch (dir) {
				case 'right': return { x: rect.x + rect.w, y: cy };
				case 'left': return { x: rect.x, y: cy };
				case 'bottom': return { x: cx, y: rect.y + rect.h };
				case 'top': return { x: cx, y: rect.y };
			}
		}

		const fromDir = naturalDir(fcx, fcy, tcx, tcy, fromNode.type);
		const toDir = naturalDir(tcx, tcy, fcx, fcy, toNode.type);

		const p1 = getPortPos(fromDir, fromRect, fcx, fcy);
		const p4 = getPortPos(toDir, toRect, tcx, tcy);

		const sH = fromDir === 'left' || fromDir === 'right';
		const eH = toDir === 'left' || toDir === 'right';
		let p2: Position, p3: Position;

		if (sH && eH) {
			const midX = (p1.x + p4.x) / 2;
			p2 = { x: midX, y: p1.y }; p3 = { x: midX, y: p4.y };
		} else if (!sH && !eH) {
			const midY = (p1.y + p4.y) / 2;
			p2 = { x: p1.x, y: midY }; p3 = { x: p4.x, y: midY };
		} else if (sH && !eH) {
			p2 = { x: p4.x, y: p1.y }; p3 = p2;
		} else {
			p2 = { x: p1.x, y: p4.y }; p3 = p2;
		}

		const GAP = 30;
		if ((fromDir === 'top' && toDir === 'top') || (fromDir === 'bottom' && toDir === 'bottom')) {
			const routeY = fromDir === 'top'
				? Math.min(fromRect.y, toRect.y) - GAP
				: Math.max(fromRect.y + fromRect.h, toRect.y + toRect.h) + GAP;
			p2 = { x: p1.x, y: routeY }; p3 = { x: p4.x, y: routeY };
		} else if ((fromDir === 'left' && toDir === 'left') || (fromDir === 'right' && toDir === 'right')) {
			const routeX = fromDir === 'left'
				? Math.min(fromRect.x, toRect.x) - GAP
				: Math.max(fromRect.x + fromRect.w, toRect.x + toRect.w) + GAP;
			p2 = { x: routeX, y: p1.y }; p3 = { x: routeX, y: p4.y };
		}

		return [p1, p2, p3, p4];
	}

	// The route: array of points the line passes through
	const route = $derived.by((): Position[] => {
		if (flow.waypoints && flow.waypoints.length > 0) {
			// With waypoints: exit from node toward first waypoint, enter to node from last waypoint
			const firstWp = flow.waypoints[0];
			const lastWp = flow.waypoints[flow.waypoints.length - 1];
			const fromPort = getPortToward(fromNode, firstWp);
			const toPort = getPortToward(toNode, lastWp);
			return [fromPort, ...flow.waypoints, toPort];
		}
		return autoRoute();
	});

	// Build the path data from route
	const pathData = $derived.by(() => {
		const pts = route;
		if (pts.length < 2) return { d: '', labelX: 0, labelY: 0, labelAnchor: 'middle' as const };

		// Pull last point back by arrow size so line stops at arrow base
		const ARROW_SIZE = 10;
		const last = pts[pts.length - 1];
		const prev = pts[pts.length - 2];
		const edx = last.x - prev.x;
		const edy = last.y - prev.y;
		const eLen = Math.sqrt(edx * edx + edy * edy);

		const adjustedPts = [...pts];
		if (eLen > ARROW_SIZE) {
			adjustedPts[adjustedPts.length - 1] = {
				x: last.x - (edx / eLen) * ARROW_SIZE,
				y: last.y - (edy / eLen) * ARROW_SIZE
			};
		}

		// Build path string
		const d = adjustedPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

		// Place label at center of total path length
		let totalLen = 0;
		const segLens: number[] = [];
		for (let i = 1; i < adjustedPts.length; i++) {
			const seg = Math.sqrt(
				(adjustedPts[i].x - adjustedPts[i - 1].x) ** 2 +
				(adjustedPts[i].y - adjustedPts[i - 1].y) ** 2
			);
			segLens.push(seg);
			totalLen += seg;
		}

		let labelX = adjustedPts[0].x, labelY = adjustedPts[0].y;
		let labelAnchor: 'middle' | 'start' | 'end' = 'middle';
		let labelSegDx = 0, labelSegDy = 0;

		if (totalLen > 0) {
			const target = totalLen * 0.5;
			let acc = 0;
			for (let i = 0; i < segLens.length; i++) {
				if (acc + segLens[i] >= target) {
					const t = segLens[i] > 0 ? (target - acc) / segLens[i] : 0;
					labelX = adjustedPts[i].x + (adjustedPts[i + 1].x - adjustedPts[i].x) * t;
					labelY = adjustedPts[i].y + (adjustedPts[i + 1].y - adjustedPts[i].y) * t;
					labelSegDx = adjustedPts[i + 1].x - adjustedPts[i].x;
					labelSegDy = adjustedPts[i + 1].y - adjustedPts[i].y;
					break;
				}
				acc += segLens[i];
			}
		}

		// Offset label to the side of the segment
		if (Math.abs(labelSegDx) >= Math.abs(labelSegDy)) {
			labelY -= 8;
		} else {
			labelX += 8;
			labelAnchor = 'start';
		}

		return { d, labelX, labelY, labelAnchor };
	});

	// Calculate path length for stroke animation
	let pathEl = $state<SVGPathElement | null>(null);
	let pathLength = $state(0);

	const estimatedLength = $derived.by(() => {
		let len = 0;
		for (let i = 1; i < route.length; i++) {
			len += Math.sqrt(
				(route[i].x - route[i - 1].x) ** 2 +
				(route[i].y - route[i - 1].y) ** 2
			);
		}
		return len;
	});

	$effect(() => {
		if (pathEl) {
			pathLength = pathEl.getTotalLength();
		}
	});

	const lineLength = $derived(pathLength > 0 ? pathLength : estimatedLength);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<g
	class="dfd-flow"
	class:selected
	class:animate-in={animateIn}
	class:dying
	{onclick}
	style="cursor: pointer; --line-length: {lineLength};"
>
	<!-- Hit area -->
	<path
		d={pathData.d}
		stroke="transparent"
		stroke-width="12"
		fill="none"
	/>

	<!-- Visible line -->
	<path
		bind:this={pathEl}
		class="flow-line"
		d={pathData.d}
		stroke={selected ? colors.selectedStroke : colors.relationshipStroke}
		stroke-width={selected ? 2 : 1.5}
		fill="none"
		marker-end="url(#dfd-arrow)"
		stroke-dasharray={animateIn || dying ? lineLength : 'none'}
		stroke-dashoffset={animateIn ? lineLength : 0}
	/>

	<!-- Label -->
	{#if flow.label}
		<text
			class="flow-label-text"
			x={pathData.labelX}
			y={pathData.labelY}
			text-anchor={pathData.labelAnchor}
			dominant-baseline="central"
			fill={colors.relationshipText}
			font-size="11"
		>
			{flow.label}
		</text>
	{/if}
</g>

<style>
	@keyframes flowLineDraw {
		to { stroke-dashoffset: 0; }
	}
	@keyframes flowLineUndraw {
		to { stroke-dashoffset: var(--line-length); }
	}
	@keyframes flowLabelIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes flowLabelOut {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	.dfd-flow.animate-in .flow-line {
		animation: flowLineDraw 0.6s ease-out forwards;
	}
	.dfd-flow.animate-in .flow-label-text {
		opacity: 0;
		animation: flowLabelIn 0.3s ease-out 0.5s forwards;
	}

	.dfd-flow.dying {
		pointer-events: none;
	}
	.dfd-flow.dying .flow-line {
		animation: flowLineUndraw 0.6s ease-in forwards;
	}
	.dfd-flow.dying .flow-label-text {
		animation: flowLabelOut 0.3s ease-in forwards;
	}
</style>
