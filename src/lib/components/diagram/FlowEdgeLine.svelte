<script lang="ts">
	import DraggableLabel from './DraggableLabel.svelte';
	import FlowSimToken from './FlowSimToken.svelte';
	import { flowSim } from '$lib/stores/flow-sim.svelte';
	import type { FlowEdge } from '$lib/types/flowchart';
	import type { FlowNode } from '$lib/types/flowchart';
	import { theme } from '$lib/stores/theme.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { getFlowEdgeRoute, type FlowPortInfo } from '$lib/utils/flow-routing';

	let {
		edge,
		fromNode,
		toNode,
		offset = 0,
		selected = false,
		dying = false,
		obstacles,
		ports,
		onclick,
		onlinemousedown,
		onlinetouchstart
	}: {
		edge: FlowEdge;
		fromNode: FlowNode;
		toNode: FlowNode;
		offset?: number;
		selected?: boolean;
		dying?: boolean;

		obstacles?: FlowNode[];

		ports?: FlowPortInfo;
		onclick?: () => void;
		onlinemousedown?: (e: MouseEvent) => void;
		onlinetouchstart?: (e: TouchEvent) => void;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	const text = $derived(edge.label || edge.condition || '');
	async function editLabel(event: MouseEvent) {
		event.stopPropagation();
		if (diagram.viewOnly || collab.isViewer || !await collab.acquireLocks([edge.id])) return;
		diagram.selectRelationship(edge.id);
		draft = text;
		editing = true;
	}
	function focusLabel(input: HTMLInputElement) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
	function saveLabel() {
		if (!editing) return;
		const value = draft.trim();
		diagram.updateFlowEdge(edge.id, { label: value, labelOffset: { ...labelOffset }, condition: value.toLowerCase() === 'yes' ? 'yes' : value.toLowerCase() === 'no' ? 'no' : undefined });
		editing = false;
	}

	const colors = $derived(theme.colors);

	const lineStyle = $derived(edge.lineStyle || 'orthogonal');
	const strokeWidth = $derived(edge.strokeWidth || 1.5);
	const strokeDash = $derived(edge.strokeDash || 'solid');
	const startArrow = $derived(edge.startArrow ?? ((edge.arrowDirection === 'start' || edge.arrowDirection === 'both') ? edge.arrowHead || 'filled' : 'none'));
	const endArrow = $derived(edge.endArrow ?? (edge.arrowDirection !== 'start' ? edge.arrowHead || 'filled' : 'none'));
	const edgeColor = $derived(edge.edgeColor || colors.relationshipStroke);

	const dashArray = $derived(() => {
		if (strokeDash === 'dashed') return '8 4';
		if (strokeDash === 'dotted') return '2 2';
		return '0';
	});

	const route = $derived(getFlowEdgeRoute(edge, fromNode, toNode, offset, obstacles, ports));

	const pathD = $derived.by(() => {
		if (lineStyle === 'straight') {

			return `M${route[0].x},${route[0].y} L${route[route.length - 1].x},${route[route.length - 1].y}`;
		} else if (lineStyle === 'curved') {

			if (route.length === 2) {
				return `M${route[0].x},${route[0].y} L${route[1].x},${route[1].y}`;
			}

			let d = `M${route[0].x},${route[0].y}`;
			for (let i = 0; i < route.length - 1; i++) {
				const p1 = route[i];
				const p2 = route[i + 1];

				if (i === 0) {

					const cp1x = p1.x + (p2.x - p1.x) * 0.5;
					const cp1y = p1.y;
					const cp2x = p2.x;
					const cp2y = p1.y + (p2.y - p1.y) * 0.5;
					d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
				} else {

					const cp1x = p1.x;
					const cp1y = p1.y + (p2.y - p1.y) * 0.5;
					const cp2x = p2.x;
					const cp2y = p1.y + (p2.y - p1.y) * 0.5;
					d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
				}
			}
			return d;
		} else {

			return route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
		}
	});


	const labelPos = $derived.by(() => {
		const pts = route;
		if (pts.length === 2) {
			return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
		}
		const mi = Math.floor(pts.length / 2);
		return { x: (pts[mi - 1].x + pts[mi].x) / 2, y: (pts[mi - 1].y + pts[mi].y) / 2 };
	});


	const conditionPos = $derived.by(() => {
		const pts = route;
		let centerX: number, centerY: number;

		if (pts.length === 2) {
			centerX = (pts[0].x + pts[1].x) / 2;
			centerY = (pts[0].y + pts[1].y) / 2;
		} else {

			const mi = Math.floor(pts.length / 2);
			centerX = (pts[mi - 1].x + pts[mi].x) / 2;
			centerY = (pts[mi - 1].y + pts[mi].y) / 2;
		}


		const mi = Math.floor(pts.length / 2);
		const isVertical = pts[mi - 1] && pts[mi] && Math.abs(pts[mi].y - pts[mi - 1].y) > Math.abs(pts[mi].x - pts[mi - 1].x);


		if (isVertical) {

			return {
				x: centerX + (edge.condition === 'yes' ? -18 : 18),
				y: centerY
			};
		} else {

			return {
				x: centerX,
				y: centerY - 12
			};
		}
	});
	const anchor = $derived(labelPos);
	const labelOffset = $derived(edge.labelOffset ?? (edge.condition ? { x: conditionPos.x - labelPos.x, y: conditionPos.y - labelPos.y } : { x: 0, y: 0 }));
	const labelWidth = $derived(Math.max(24, (editing ? draft : text).length * 7 + 8));
</script>

<defs>
 {#each [{ end: 'start', head: startArrow }, { end: 'end', head: endArrow }] as marker}
 {@const reached = flowSim.running && (marker.end === 'start' ? flowSim.edgeProgress.has(edge.id) || flowSim.traversedEdgeIds.has(edge.id) : flowSim.traversedEdgeIds.has(edge.id))}
 {@const markerColor = reached ? '#22c55e' : selected ? colors.selectedStroke : edgeColor}
 <marker id={`flow-head-${marker.end}-${edge.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth={7 * strokeWidth} markerHeight={7 * strokeWidth} orient="auto-start-reverse">
  {#if marker.head === 'open'}
   <path d="M1,1 L9,5 L1,9" fill="none" stroke={markerColor} stroke-width="1.5" />
  {:else if marker.head === 'diamond'}
   <path d="M0,5 L5,1 L9,5 L5,9 Z" fill={markerColor} />
  {:else}
   <path d="M0,0 L10,5 L0,10 Z" fill={markerColor} />
  {/if}
 </marker>
 {/each}
</defs>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<g
	class="flow-edge"
	class:selected
	class:dying
	{onclick}
	style="cursor: move;"
>

	<path
		d={pathD}
		ondblclick={editLabel}
		stroke="transparent"
		stroke-width="12"
		fill="none"
		onmousedown={(e) => { if (onlinemousedown && e.button === 0) { e.stopPropagation(); onlinemousedown(e); } }}
		ontouchstart={(e) => { if (onlinetouchstart) { e.stopPropagation(); onlinetouchstart(e); } }}
	/>



	<path
		class="edge-visible"
		ondblclick={editLabel}
		d={pathD}
		stroke={selected ? colors.selectedStroke : edgeColor}
		stroke-width={selected ? strokeWidth + 0.5 : strokeWidth}
		stroke-dasharray={dashArray()}
		pathLength={dying ? 1 : undefined}
		fill="none"
		marker-start={startArrow !== 'none' ? `url(#flow-head-start-${edge.id})` : undefined}
		marker-end={endArrow !== 'none' ? `url(#flow-head-end-${edge.id})` : undefined}
	/>



	{#if flowSim.running}
		{#if flowSim.traversedEdgeIds.has(edge.id)}
			<path d={pathD} fill="none" stroke="#22c55e" stroke-width={strokeWidth} style="pointer-events:none" />
		{/if}
		{@const progress = flowSim.edgeProgress.get(edge.id)}
		{#if progress !== undefined}
			<FlowSimToken d={pathD} t={progress} {strokeWidth} />
		{/if}
	{/if}
	<DraggableLabel onclick={(event) => { if (!editing) editLabel(event); }} offset={labelOffset} {anchor} {route} onchange={(labelOffset) => diagram.updateFlowEdge(edge.id, { labelOffset })}>
		{#if editing || text}
			<rect x={anchor.x - labelWidth / 2} y={anchor.y - 10} width={labelWidth} height="20" fill={colors.entityFill} rx="3" />
		{/if}
		{#if editing}
			<foreignObject x={anchor.x - labelWidth / 2} y={anchor.y - 10} width={labelWidth} height="20">
				<input aria-label="Flowchart edge label" bind:value={draft} use:focusLabel onblur={saveLabel} onmousedown={(event) => event.stopPropagation()} ondblclick={(event) => event.stopPropagation()} onkeydown={(event) => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); saveLabel(); } if (event.key === 'Escape') { event.preventDefault(); editing = false; } }} style="width:100%;height:20px;padding:0;border:0;outline:none;background:transparent;color:{colors.relationshipText};font-size:11px;font-family:inherit;text-align:center;line-height:20px;box-sizing:border-box;display:block" />
			</foreignObject>
		{:else if text}
			<g>
				<text x={anchor.x} y={anchor.y} text-anchor="middle" dominant-baseline="central" fill={colors.relationshipText} font-size="11">{text}</text>
			</g>
		{/if}
	</DraggableLabel>
	{#if selected && lineStyle === 'orthogonal' && !diagram.viewOnly && !collab.isViewer && !dying}
		{#each route.slice(1) as point, i}
			{@const previous = route[i]}
			{#if Math.hypot(point.x - previous.x, point.y - previous.y) * diagram.zoom > 24}
				<circle cx={(point.x + previous.x) / 2} cy={(point.y + previous.y) / 2} r={9 / diagram.zoom} fill="transparent" style="cursor:move" onmousedown={(e) => { if (e.button === 0) { e.preventDefault(); e.stopPropagation(); onlinemousedown?.(e); } }} ontouchstart={(e) => { e.stopPropagation(); onlinetouchstart?.(e); }} />
				<circle cx={(point.x + previous.x) / 2} cy={(point.y + previous.y) / 2} r={3 / diagram.zoom} fill={colors.selectedStroke} stroke="white" stroke-width={1 / diagram.zoom} style="pointer-events:none" />
			{/if}
		{/each}
	{/if}
</g>

<style>

	.flow-edge.dying {
		pointer-events: none;
	}
	/* Undraw the line: retract the stroke along the path (pathLength=1 normalises
	   it) so the edge peels away toward its start, matching the ER crow-foot
	   relationship undraw. Hide the arrowhead so it vanishes with the line. */
	@keyframes edgeUndraw {
		from { stroke-dashoffset: 0; }
		to   { stroke-dashoffset: 1; }
	}
	.flow-edge.dying .edge-visible {
		stroke-dasharray: 1;
		animation: edgeUndraw 0.5s ease-in forwards;
		marker-end: none;
	}
</style>
