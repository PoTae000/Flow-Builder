<script lang="ts">
	import { flowSim } from '$lib/stores/flow-sim.svelte';
	import type { FlowNode } from '$lib/types/flowchart';
	import type { Position } from '$lib/types/geometry';
	import { theme } from '$lib/stores/theme.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { wrapFlowNodeLabel, measureFlowText, flowNodeFontSize, flowNodeFontWeight } from '$lib/utils/flow-node-size';

	let {
		node,
		selected = false,
		animateIn = false,
		dying = false,
		editing = false,
		altHeld = false,
		onmousedown,
		onclick,
		ontouchstart,
		oncontextmenu,
		onStartEdit,
		onWordMouseDown
	}: {
		node: FlowNode;
		selected?: boolean;
		animateIn?: boolean;
		dying?: boolean;
		editing?: boolean;
		altHeld?: boolean;
		onmousedown?: (e: MouseEvent) => void;
		onclick?: (e: MouseEvent) => void;
		ontouchstart?: (e: TouchEvent) => void;
		oncontextmenu?: (e: MouseEvent) => void;
		onStartEdit?: (nodeId: string) => void;
		onWordMouseDown?: (wordIndex: number, e: MouseEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);
	const nodeStroke = $derived(selected ? colors.selectedStroke : colors.entityStroke);

	const W = $derived(node.width || (node.type === 'connector' ? 28 : 140));
	const H = $derived(node.height || (node.type === 'connector' ? 28 : 60));
	const cx = $derived(node.position.x);
	const cy = $derived(node.position.y);


	const fontSize = $derived(flowNodeFontSize(node, diagram.diagramFontSize));

	const isBold = $derived(node.bold ?? true);
	const isItalic = $derived(node.italic ?? false);
	const fontWeight = $derived(flowNodeFontWeight(node));



	const LINE_HEIGHT = $derived(Math.round(fontSize * 1.25));
	const displayLines = $derived(wrapFlowNodeLabel(node, diagram.diagramFontSize));


	const firstLineY = $derived(cy - ((displayLines.length - 1) * LINE_HEIGHT) / 2);





	interface WordLayout {
		index: number;
		text: string;
		x: number;
		y: number;
		w: number;
	}




	const wordLayout = $derived.by<WordLayout[]>(() => {
		if (node.type !== 'preparation') return [];
		const fw = fontWeight;
		const lines = wrapFlowNodeLabel(node, diagram.diagramFontSize);
		const offsets = node.wordOffsets ?? {};
		const out: WordLayout[] = [];
		let wordIndex = 0;
		for (let li = 0; li < lines.length; li++) {
			const line = lines[li] || ' ';
			const words = line.split(/\s+/).filter(Boolean);


			const lineWidth = measureFlowText(line, fontSize, fw, isItalic);
			let cursorX = cx - lineWidth / 2;
			const y = firstLineY + li * LINE_HEIGHT;
			for (const w of words) {
				const ww = measureFlowText(w, fontSize, fw, isItalic);
				const off = offsets[wordIndex];
				out.push({
					index: wordIndex,
					text: w,
					x: off ? cx + off.x : cursorX + ww / 2,
					y: off ? cy + off.y : y,
					w: ww
				});
				cursorX += ww + measureFlowText(' ', fontSize, fw, isItalic);
				wordIndex++;
			}
		}
		return out;
	});
	function traceOutline(host: SVGGElement, progress: number) {
		const outlines: SVGPathElement[] = [];
		function update(value: number) {
			if (!outlines.length) {
				const shape = host.parentElement?.querySelector(':scope > rect, :scope > polygon, :scope > circle, :scope > ellipse, :scope > path') as SVGGeometryElement | null;
				if (!shape) return;
				const length = shape.getTotalLength();
				if (!length) return;
				const round = shape.tagName.toLowerCase() === 'circle' || shape.tagName.toLowerCase() === 'ellipse';
				const bounds = shape.getBBox();
				let start = 0, distance = Infinity;
				for (let i = 0; i < 400; i++) {
					const point = shape.getPointAtLength(length * i / 400);
					const delta = Math.hypot(point.x - bounds.x - bounds.width / 2, point.y - bounds.y);
					if (delta < distance) { distance = delta; start = length * i / 400; }
				}
				for (const direction of round ? [1] : [1, -1]) {
				const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				outline.setAttribute('d', Array.from({ length: 201 }, (_, i) => {
					const position = (((round ? 0 : start) + direction * length * i / (round ? 200 : 400)) % length + length) % length;
					const point = shape.getPointAtLength(position);
					return `${i ? 'L' : 'M'}${point.x},${point.y}`;
				}).join(' '));
				outline.setAttribute('fill', 'none');
				outline.setAttribute('stroke', '#22c55e');
				outline.setAttribute('stroke-width', '1.5');
				outline.setAttribute('pathLength', '1');
				host.appendChild(outline);
				outlines.push(outline);
				}
			}
			for (const outline of outlines) outline.setAttribute('stroke-dasharray', `${Math.max(0, Math.min(1, value))} 1`);
		}
		update(progress);
		return { update };
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
	class="flow-node"
	class:selected
	class:animate-in={animateIn}
	class:dying
	role="button"
	tabindex="0"
	aria-label="Flow node: {node.name}"
	{onmousedown}
	{onclick}
	{ontouchstart}
	{oncontextmenu}
	ondblclick={(e) => {
		e.stopPropagation();
		onStartEdit?.(node.id);
	}}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: grab;"
>




	{#if node.type === 'start-end'}

		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			rx={node.borderRadius ?? 20}
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'process'}

		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'decision'}

		<polygon
			points="{cx},{cy - H / 2 - 5} {cx + W / 2 + 10},{cy} {cx},{cy + H / 2 + 5} {cx - W / 2 - 10},{cy}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'input-output'}

		<polygon
			points="{cx - W / 2 + 15},{cy - H / 2} {cx + W / 2},{cy - H / 2} {cx + W / 2 - 15},{cy + H / 2} {cx - W / 2},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'connector'}

		<circle
			cx={cx}
			cy={cy}
			r={Math.min(W, H) / 2}
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'document'}

		<path
			d="M{cx - W / 2},{cy - H / 2}
			   h{W}
			   v{H - 10}
			   q{-W / 4},{10} {-W / 2},{0}
			   q{-W / 4},{-10} {-W / 2},{0}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'database'}

		<path
			d="M{cx - W / 2},{cy - H / 2 + 10}
			   a{W / 2},{10} 0 0,1 {W},{0}
			   v{H - 20}
			   a{W / 2},{10} 0 0,1 {-W},{0}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>

		<ellipse
			cx={cx}
			cy={cy - H / 2 + 10}
			rx={W / 2}
			ry="10"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'predefined-process'}

		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
		<line
			x1={cx - W / 2 + 10}
			y1={cy - H / 2}
			x2={cx - W / 2 + 10}
			y2={cy + H / 2}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
		<line
			x1={cx + W / 2 - 10}
			y1={cy - H / 2}
			x2={cx + W / 2 - 10}
			y2={cy + H / 2}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'manual-operation'}

		<polygon
			points="{cx - W / 2},{cy - H / 2} {cx + W / 2},{cy - H / 2} {cx + W / 2 - 15},{cy + H / 2} {cx - W / 2 + 15},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'preparation'}

		<polygon
			points="{cx - W / 2 + 20},{cy - H / 2} {cx + W / 2 - 20},{cy - H / 2} {cx + W / 2},{cy} {cx + W / 2 - 20},{cy + H / 2} {cx - W / 2 + 20},{cy + H / 2} {cx - W / 2},{cy}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'delay'}

		<path
			d="M{cx - W / 2},{cy - H / 2}
			   h{W - H / 2}
			   a{H / 2},{H / 2} 0 0,1 0,{H}
			   h{-(W - H / 2)}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'display'}

		<path
			d="M{cx - W / 2 + 15},{cy - H / 2}
			   h{W - 15 - H / 2}
			   a{H / 2},{H / 2} 0 0,1 0,{H}
			   h{-(W - 15 - H / 2)}
			   l{-15},{-H / 2}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'internal-storage'}

		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
		<line
			x1={cx - W / 2 + 12}
			y1={cy - H / 2}
			x2={cx - W / 2 + 12}
			y2={cy + H / 2}
			stroke={nodeStroke}
			stroke-width="1" pathLength="100"
		/>
		<line
			x1={cx - W / 2}
			y1={cy - H / 2 + 12}
			x2={cx + W / 2}
			y2={cy - H / 2 + 12}
			stroke={nodeStroke}
			stroke-width="1" pathLength="100"
		/>
	{:else if node.type === 'manual-input'}

		<polygon
			points="{cx - W / 2},{cy - H / 2 + 12} {cx + W / 2},{cy - H / 2} {cx + W / 2},{cy + H / 2} {cx - W / 2},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'off-page-connector'}

		<polygon
			points="{cx - W / 2},{cy - H / 2} {cx + W / 2},{cy - H / 2} {cx + W / 2},{cy + H / 4} {cx},{cy + H / 2} {cx - W / 2},{cy + H / 4}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'merge'}

		<polygon
			points="{cx - W / 2},{cy - H / 2} {cx + W / 2},{cy - H / 2} {cx},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'extract'}

		<polygon
			points="{cx},{cy - H / 2} {cx + W / 2},{cy + H / 2} {cx - W / 2},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'or'}

		<circle cx={cx} cy={cy} r={Math.min(W, H) / 2} fill={node.color || colors.entityFill} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
		<line x1={cx - Math.min(W, H) / 2} y1={cy} x2={cx + Math.min(W, H) / 2} y2={cy} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
		<line x1={cx} y1={cy - Math.min(W, H) / 2} x2={cx} y2={cy + Math.min(W, H) / 2} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
	{:else if node.type === 'summing-junction'}

		{@const sr = Math.min(W, H) / 2}
		{@const d = sr * 0.7071}
		<circle cx={cx} cy={cy} r={sr} fill={node.color || colors.entityFill} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
		<line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
		<line x1={cx - d} y1={cy + d} x2={cx + d} y2={cy - d} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
	{:else if node.type === 'stored-data'}

		<path
			d="M{cx - W / 2 + 12},{cy - H / 2}
			   h{W - 12}
			   q{-14},{H / 2} 0,{H}
			   h{-(W - 12)}
			   q14,{-H / 2} 0,{-H}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'ellipse'}
		<ellipse cx={cx} cy={cy} rx={W / 2} ry={H / 2} fill={node.color || colors.entityFill} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
	{:else if node.type === 'circle'}
		<circle cx={cx} cy={cy} r={Math.min(W, H) / 2} fill={node.color || colors.entityFill} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
	{:else if node.type === 'square'}
		{@const sq = Math.min(W, H)}
		<rect x={cx - sq / 2} y={cy - sq / 2} width={sq} height={sq} fill={node.color || colors.entityFill} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
	{:else if node.type === 'triangle'}

		<polygon
			points="{cx},{cy - H / 2} {cx + W / 2},{cy + H / 2} {cx - W / 2},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'trapezoid'}

		<polygon
			points="{cx - W / 2 + 20},{cy - H / 2} {cx + W / 2 - 20},{cy - H / 2} {cx + W / 2},{cy + H / 2} {cx - W / 2},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'cloud'}

		<path
			d="M{cx - W * 0.30},{cy + H * 0.28}
			   a{H * 0.28},{H * 0.28} 0 0,1 {-W * 0.06},{-H * 0.5}
			   a{H * 0.30},{H * 0.30} 0 0,1 {W * 0.22},{-H * 0.22}
			   a{H * 0.32},{H * 0.32} 0 0,1 {W * 0.40},0
			   a{H * 0.30},{H * 0.30} 0 0,1 {W * 0.20},{H * 0.28}
			   a{H * 0.26},{H * 0.26} 0 0,1 {-W * 0.08},{H * 0.44}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'callout'}

		<path
			d="M{cx - W / 2},{cy - H / 2}
			   h{W}
			   v{H * 0.7}
			   h{-(W * 0.35)}
			   l{-12},{H * 0.3}
			   l{-8},{-(H * 0.3)}
			   h{-(W * 0.5)}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'card'}

		<polygon
			points="{cx - W / 2 + 18},{cy - H / 2} {cx + W / 2},{cy - H / 2} {cx + W / 2},{cy + H / 2} {cx - W / 2},{cy + H / 2} {cx - W / 2},{cy - H / 2 + 18}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'step'}

		<polygon
			points="{cx - W / 2},{cy - H / 2} {cx + W / 2 - 18},{cy - H / 2} {cx + W / 2},{cy} {cx + W / 2 - 18},{cy + H / 2} {cx - W / 2},{cy + H / 2} {cx - W / 2 + 18},{cy}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'star'}

		{@const sr2 = Math.min(W, H) / 2}
		{@const star = [0,1,2,3,4,5,6,7,8,9].map((k) => {
			const ang = -Math.PI / 2 + (k * Math.PI) / 5;
			const rr = k % 2 === 0 ? sr2 : sr2 * 0.4;
			return `${cx + rr * Math.cos(ang)},${cy + rr * Math.sin(ang)}`;
		}).join(' ')}
		<polygon
			points={star}
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'cross'}

		{@const t = Math.min(W, H) * 0.28}
		<polygon
			points="{cx - t},{cy - H / 2} {cx + t},{cy - H / 2} {cx + t},{cy - t} {cx + W / 2},{cy - t} {cx + W / 2},{cy + t} {cx + t},{cy + t} {cx + t},{cy + H / 2} {cx - t},{cy + H / 2} {cx - t},{cy + t} {cx - W / 2},{cy + t} {cx - W / 2},{cy - t} {cx - t},{cy - t}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'tape'}

		<path
			d="M{cx - W / 2},{cy - H / 2 + 6}
			   q{W / 4},{-12} {W / 2},{0}
			   q{W / 4},{12} {W / 2},{0}
			   v{H - 12}
			   q{-W / 4},{12} {-W / 2},{0}
			   q{-W / 4},{-12} {-W / 2},{0}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'arrow-right'}

		<polygon
			points="{cx - W / 2},{cy - H / 4} {cx + W / 2 - 20},{cy - H / 4} {cx + W / 2 - 20},{cy - H / 2} {cx + W / 2},{cy} {cx + W / 2 - 20},{cy + H / 2} {cx + W / 2 - 20},{cy + H / 4} {cx - W / 2},{cy + H / 4}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'arrow-left'}

		<polygon
			points="{cx + W / 2},{cy - H / 4} {cx - W / 2 + 20},{cy - H / 4} {cx - W / 2 + 20},{cy - H / 2} {cx - W / 2},{cy} {cx - W / 2 + 20},{cy + H / 2} {cx - W / 2 + 20},{cy + H / 4} {cx + W / 2},{cy + H / 4}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'arrow-up'}

		<polygon
			points="{cx - W / 4},{cy + H / 2} {cx - W / 4},{cy - H / 2 + 20} {cx - W / 2},{cy - H / 2 + 20} {cx},{cy - H / 2} {cx + W / 2},{cy - H / 2 + 20} {cx + W / 4},{cy - H / 2 + 20} {cx + W / 4},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'arrow-down'}

		<polygon
			points="{cx - W / 4},{cy - H / 2} {cx - W / 4},{cy + H / 2 - 20} {cx - W / 2},{cy + H / 2 - 20} {cx},{cy + H / 2} {cx + W / 2},{cy + H / 2 - 20} {cx + W / 4},{cy + H / 2 - 20} {cx + W / 4},{cy - H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'arrow-bidirectional'}

		<polygon
			points="{cx - W / 2},{cy} {cx - W / 2 + 20},{cy - H / 2} {cx - W / 2 + 20},{cy - H / 4} {cx + W / 2 - 20},{cy - H / 4} {cx + W / 2 - 20},{cy - H / 2} {cx + W / 2},{cy} {cx + W / 2 - 20},{cy + H / 2} {cx + W / 2 - 20},{cy + H / 4} {cx - W / 2 + 20},{cy + H / 4} {cx - W / 2 + 20},{cy + H / 2}"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'uml-class'}

		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
		<line
			x1={cx - W / 2}
			y1={cy - H / 2 + 22}
			x2={cx + W / 2}
			y2={cy - H / 2 + 22}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'uml-actor'}

		{@const acx = cx}
		<circle cx={acx} cy={cy - H / 2 + 10} r="8" fill="none" stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
		<line x1={acx} y1={cy - H / 2 + 18} x2={acx} y2={cy + H / 2 - 18} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
		<line x1={acx - 14} y1={cy - H / 2 + 26} x2={acx + 14} y2={cy - H / 2 + 26} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
		<line x1={acx} y1={cy + H / 2 - 18} x2={acx - 12} y2={cy + H / 2} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
		<line x1={acx} y1={cy + H / 2 - 18} x2={acx + 12} y2={cy + H / 2} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
	{:else if node.type === 'uml-note'}

		{@const fold = 14}
		<path
			d="M{cx - W / 2},{cy - H / 2}
			   h{W - fold}
			   l{fold},{fold}
			   v{H - fold}
			   h{-W}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
		<path
			d="M{cx + W / 2 - fold},{cy - H / 2} v{fold} h{fold} Z"
			fill="none"
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'uml-package'}

		{@const tabW = W * 0.4}
		<path
			d="M{cx - W / 2},{cy - H / 2 + 14}
			   h{tabW}
			   v{-14}
			   h{W - tabW}
			   v{H - 14}
			   h{-W}
			   Z"
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
	{:else if node.type === 'uml-component'}

		<rect
			x={cx - W / 2}
			y={cy - H / 2}
			width={W}
			height={H}
			fill={node.color || colors.entityFill}
			stroke={nodeStroke}
			stroke-width="1.5" pathLength="100"
		/>
		<rect x={cx - W / 2 - 6} y={cy - H / 4 - 4} width="12" height="8" fill={node.color || colors.entityFill} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
		<rect x={cx - W / 2 - 6} y={cy + H / 4 - 4} width="12" height="8" fill={node.color || colors.entityFill} stroke={nodeStroke} stroke-width="1.5" pathLength="100" />
	{/if}


	{#if !editing}
		{#if node.type === 'preparation' && wordLayout.length > 0}
			{#each wordLayout as w}
				{#if altHeld}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<rect
						x={w.x - w.w / 2 - 2}
						y={w.y - fontSize * 0.6}
						width={w.w + 4}
						height={fontSize * 1.2}
						rx="3"
						fill={selected ? colors.selectedStroke : 'transparent'}
						fill-opacity={selected ? 0.12 : 0}
						stroke={nodeStroke}
						stroke-width="1"
						stroke-dasharray="3 2"
						stroke-opacity="0.5"
						style="cursor: move;"
						onmousedown={(e) => onWordMouseDown?.(w.index, e)}
					/>
				{/if}
				<text
					x={w.x}
					y={w.y}
					text-anchor="middle"
					dominant-baseline="central"
					fill={colors.entityHeaderText}
					font-size={fontSize}
					font-weight={fontWeight}
					font-style={isItalic ? 'italic' : 'normal'}
					style={altHeld ? 'cursor: move; pointer-events: none;' : 'pointer-events: none;'}
				>{w.text}</text>
			{/each}
		{:else}
			<text
				x={cx}
				y={firstLineY}
				text-anchor="middle"
				dominant-baseline="central"
				fill={colors.entityHeaderText}
				font-size={fontSize}
				font-weight={fontWeight}
				font-style={isItalic ? 'italic' : 'normal'}
			>
				{#each displayLines as line, i}
					<tspan x={cx} dy={i === 0 ? 0 : LINE_HEIGHT}>{line || ' '}</tspan>
				{/each}
			</text>
		{/if}
	{/if}
	{#if flowSim.running && flowSim.nodeProgress.has(node.id)}
		<g use:traceOutline={flowSim.nodeProgress.get(node.id) ?? 0} style="pointer-events:none" />
	{/if}
</g>

<style>
	@keyframes nodeAppear {
		from { opacity: 0; transform: scale(0.8); }
		to { opacity: 1; transform: scale(1); }
	}
	.flow-node.animate-in {
		animation: nodeAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		transform-origin: center;
		transform-box: fill-box;
	}
	/* Dying: undraw the shape's outline following its actual geometry (every shape
	   element carries pathLength="100", so one rule retracts them all uniformly),
	   while the fill and label fade out — matching the ER crow-foot delete style. */
	@keyframes shapeUndraw {
		from { stroke-dashoffset: 0; }
		to   { stroke-dashoffset: 100; }
	}
	@keyframes shapeFillFade {
		from { opacity: 1; }
		to   { opacity: 0; }
	}
	.flow-node.dying {
		pointer-events: none;
	}
	/* Outline strokes retract along their path. */
	.flow-node.dying :is(rect, circle, ellipse, polygon, path, line) {
		stroke-dasharray: 100;
		animation: shapeUndraw 0.6s ease-in forwards;
	}
	/* Fill and text fade a touch faster so the outline is the last thing to go. */
	.flow-node.dying :is(rect, circle, ellipse, polygon, path) {
		fill-opacity: 1;
		animation:
			shapeUndraw 0.6s ease-in forwards,
			shapeFillFade 0.45s ease-in forwards;
	}
	.flow-node.dying text {
		animation: shapeFillFade 0.35s ease-in forwards;
	}
	.flow-node { transition: filter 0.15s ease; }
	.flow-node:hover { filter: drop-shadow(0 0 4px rgba(59,130,246,0.2)); }
</style>
