<script lang="ts">
 import type { FlowEdge } from '$lib/types/flowchart';
 import type { Position } from '$lib/types/geometry';
 import { diagram } from '$lib/stores/diagram.svelte';
 import { getFlowPort } from '$lib/utils/flow-routing';
 let { edge, route }: { edge: FlowEdge; route: Position[] } = $props();
 let root: SVGGElement;
 let endpointDrag: 'fromSide' | 'toSide' | null = null;
 function moveEndpoint(e: PointerEvent) {
  if (!endpointDrag || !root) return;
  const svg = root.ownerSVGElement;
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const point = { x: (e.clientX - rect.left - diagram.panX) / diagram.zoom, y: (e.clientY - rect.top - diagram.panY) / diagram.zoom };
  const node = diagram.flowNodes.find(n => n.id === (endpointDrag === 'fromSide' ? edge.fromNodeId : edge.toNodeId));
  if (!node) return;
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const nearest = [...sides].sort((a, b) => {
   const pa = getFlowPort(node, a), pb = getFlowPort(node, b);
   return Math.hypot(pa.x - point.x, pa.y - point.y) - Math.hypot(pb.x - point.x, pb.y - point.y);
  })[0];
  if (edge[endpointDrag] !== nearest) diagram.updateFlowEdge(edge.id, { [endpointDrag]: nearest });
 }
 let toolOffset = $state({ x: 0, y: 0 });
 let toolDrag: { pointer: number; x: number; y: number; offsetX: number; offsetY: number } | null = null;
 function startToolDrag(e: PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
  toolDrag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, offsetX: toolOffset.x, offsetY: toolOffset.y };
 }
 function moveToolDrag(e: PointerEvent) {
  if (!toolDrag || toolDrag.pointer !== e.pointerId) return;
  e.stopPropagation();
  toolOffset = { x: toolDrag.offsetX + e.clientX - toolDrag.x, y: toolDrag.offsetY + e.clientY - toolDrag.y };
 }
 function endToolDrag(e: PointerEvent) {
  if (toolDrag?.pointer !== e.pointerId) return;
  toolDrag = null;
  if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) (e.currentTarget as Element).releasePointerCapture(e.pointerId);
 }
 const lineStyle = $derived(edge.lineStyle || 'orthogonal');
 const strokeDash = $derived(edge.strokeDash || 'solid');
 const labelPos = $derived.by(() => {
  const i = Math.floor(route.length / 2);
  return { x: (route[i - 1].x + route[i].x) / 2, y: (route[i - 1].y + route[i].y) / 2 };
 });
 const toolbarPosition = $derived.by(() => {
  const i = Math.floor(route.length / 2);
  const vertical = Math.abs(route[i].y - route[i - 1].y) > Math.abs(route[i].x - route[i - 1].x);
  return { x: vertical ? -120 : -38, y: vertical ? -12 : -64 };
 });

	const connectionOptions = [
		{ value: 'straight', label: 'เส้นตรง', path: 'M3 21L21 3' },
		{ value: 'auto', label: 'หักมุมอัตโนมัติ', path: 'M3 21V12h18V3' },
		{ value: 'step', label: 'ขั้นบันได', path: 'M3 21V15h6V9h6V3h6' },
		{ value: 'horizontal', label: 'เข้าออกแนวนอน', path: 'M2 18h10V6h10' },
		{ value: 'vertical', label: 'เข้าออกแนวตั้ง', path: 'M6 22V12h12V2' },
		{ value: 'elbow', label: 'หักมุมเดียว', path: 'M3 21V3h18' },
		{ value: 'curved', label: 'เส้นโค้ง', path: 'M3 21C3 3 21 21 21 3' }
	] as const;
	function applyConnection(value: (typeof connectionOptions)[number]['value']) {
		const from = diagram.flowNodes.find(n => n.id === edge.fromNodeId), to = diagram.flowNodes.find(n => n.id === edge.toNodeId);
		if (!from || !to) return;
		const right = to.position.x >= from.position.x, down = to.position.y >= from.position.y;
		diagram.updateFlowEdge(edge.id, {
			lineStyle: value === 'straight' || value === 'curved' ? value : 'orthogonal',
			routingMode: value === 'straight' || value === 'curved' ? 'auto' : value,
			fromSide: value === 'horizontal' || value === 'elbow' ? (right ? 'right' : 'left') : value === 'vertical' ? (down ? 'bottom' : 'top') : undefined,
			toSide: value === 'horizontal' ? (right ? 'left' : 'right') : value === 'vertical' || value === 'elbow' ? (down ? 'top' : 'bottom') : undefined
		});
	}
	let arrowMenu = $state<string | null>(null);
	let menuOpen = $state<'stroke' | 'arrow' | 'shape' | null>(null);
	$effect(() => { edge.id; menuOpen = null; toolOffset = { x: 0, y: 0 }; toolDrag = null; });

</script>
{#snippet arrowIcon(head: string, end: string)}
 <svg viewBox="0 0 24 24" style={end === 'start' ? 'transform:rotate(180deg)' : ''}>
 <path d="M3 12h17" />
 {#if head === 'filled'}<path d="M14 7l7 5-7 5Z" fill="currentColor" />{:else if head === 'open'}<path d="M15 7l6 5-6 5" />{:else if head === 'diamond'}<path d="M13 12l4-4 4 4-4 4Z" fill="currentColor" />{/if}
 </svg>
{/snippet}
<svelte:window onpointermove={moveEndpoint} onpointerup={() => endpointDrag = null} onpointercancel={() => endpointDrag = null} onpointerdowncapture={(e) => { if (root && !root.contains(e.target as Node)) menuOpen = null; }} onkeydown={(e) => { if (e.key === 'Escape') { menuOpen = null; endpointDrag = null; } }} />
<g class="flow-edge">
 {#each ['fromSide', 'toSide'] as end}
  {@const point = end === 'fromSide' ? route[0] : route[route.length - 1]}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <circle cx={point.x} cy={point.y} r={9 / diagram.zoom} fill="transparent" style="cursor:grab;touch-action:none" onpointerdown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); endpointDrag = end as 'fromSide' | 'toSide'; (e.currentTarget as Element).setPointerCapture(e.pointerId); }} />
  <circle cx={point.x} cy={point.y} r={4 / diagram.zoom} fill="var(--ui-bg)" stroke="#60a5fa" stroke-width={1.5 / diagram.zoom} style="pointer-events:none" />
 {/each}
</g>
<g class="flow-edge" bind:this={root} transform={`translate(${labelPos.x + (toolOffset.x + toolbarPosition.x) / diagram.zoom}, ${labelPos.y + (toolOffset.y + toolbarPosition.y) / diagram.zoom}) scale(${0.8 / diagram.zoom})`}>
		<foreignObject x="0" y="0" width="160" height={menuOpen ? 130 : 32} style="overflow:visible;pointer-events:none">
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="edge-tools" onmousedown={(e) => e.stopPropagation()} onpointerdown={(e) => e.stopPropagation()} onclick={(e) => e.stopPropagation()} ondblclick={(e) => e.stopPropagation()}>
				<button class="tool-grip" aria-label="ลากแถบปรับเส้น" title="ลากเพื่อย้ายแถบปรับเส้น" onpointerdown={startToolDrag} onpointermove={moveToolDrag} onpointerup={endToolDrag} onpointercancel={endToolDrag}><svg viewBox="0 0 12 16"><path d="M4 3h0M8 3h0M4 8h0M8 8h0M4 13h0M8 13h0" stroke-width="2.5" /></svg></button>
				<button aria-label="เปลี่ยนเส้นทึบหรือเส้นประ" title="เส้นทึบ / เส้นประ / เส้นจุด" onclick={() => menuOpen = menuOpen === 'stroke' ? null : 'stroke'}>
					<svg viewBox="0 0 16 16"><path d="M2 8h12" stroke-dasharray={edge.strokeDash === 'dashed' ? '4 2' : edge.strokeDash === 'dotted' ? '1 2' : undefined} /></svg>
				</button>
				<button aria-label="เปลี่ยนหัวลูกศร" title="เปลี่ยนหัวลูกศร" onclick={() => menuOpen = menuOpen === 'arrow' ? null : 'arrow'}>
					<svg viewBox="0 0 16 16"><path d="M2 8h11" />{#if edge.arrowHead !== 'none'}<path d="M9 3l5 5-5 5" fill={edge.arrowHead === 'open' ? 'none' : 'currentColor'} />{/if}</svg>
				</button>
				<button aria-label="เปลี่ยนรูปแบบเส้น" title="เส้นหักมุม / เส้นโค้ง / เส้นตรง" onclick={() => menuOpen = menuOpen === 'shape' ? null : 'shape'}>
					<svg viewBox="0 0 16 16"><path d={lineStyle === 'curved' ? 'M3 13V8Q3 3 8 3h5' : lineStyle === 'straight' ? 'M3 13L13 3' : 'M3 13V3h10'} /></svg>
				</button>
			</div>
			{#if menuOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="connection-menu" class:compact-shape={menuOpen === 'shape'} role="group" aria-label="การเชื่อมต่อ" onmousedown={(e) => e.stopPropagation()} onpointerdown={(e) => e.stopPropagation()} onclick={(e) => e.stopPropagation()} onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Escape') menuOpen = null; }}>
					{#if menuOpen === 'stroke'}
						<select aria-label="ลักษณะเส้น" value={edge.strokeDash || 'solid'} onchange={(e) => diagram.updateFlowEdge(edge.id, { strokeDash: e.currentTarget.value as FlowEdge['strokeDash'] })}>
							<option value="solid">──── เส้นทึบ</option><option value="dashed">– – – เส้นประ</option><option value="dotted">······ เส้นจุด</option>
						</select>
						<div class="setting-row">
							<label>ความหนา<input aria-label="ความหนาเส้น" type="number" min="1" max="8" step="0.5" value={edge.strokeWidth || 1.5} onchange={(e) => { const n = e.currentTarget.valueAsNumber; if (Number.isFinite(n)) diagram.updateFlowEdge(edge.id, { strokeWidth: Math.min(8, Math.max(1, n)) }); }} /></label>
							<label class="color-setting">สี<input aria-label="สีเส้น" type="color" value={edge.edgeColor || '#6b7280'} onchange={(e) => diagram.updateFlowEdge(edge.id, { edgeColor: e.currentTarget.value })} /></label>
						</div>
					{:else if menuOpen === 'arrow'}

 <div class="setting-row">
 {#each ['start', 'end'] as end}
 {@const current = end === 'start' ? (edge.startArrow ?? ((edge.arrowDirection === 'start' || edge.arrowDirection === 'both') ? edge.arrowHead || 'filled' : 'none')) : (edge.endArrow ?? (edge.arrowDirection !== 'start' ? edge.arrowHead || 'filled' : 'none'))}
 <div class="arrow-select">
 <span>{end === 'start' ? '\u0e15\u0e49\u0e19\u0e40\u0e2a\u0e49\u0e19' : '\u0e1b\u0e25\u0e32\u0e22\u0e40\u0e2a\u0e49\u0e19'}</span>
 <button class="arrow-trigger" aria-label={end === 'start' ? 'Start arrow' : 'End arrow'} aria-expanded={arrowMenu === end} onclick={() => arrowMenu = arrowMenu === end ? null : end}>
 {@render arrowIcon(current, end)}<svg class="chevron" viewBox="0 0 12 12"><path d="M3 4l3 3 3-3" /></svg>
 </button>
 {#if arrowMenu === end}
 <div class="arrow-options" role="group" aria-label="Arrowheads">
 {#each ['none', 'filled', 'open', 'diamond'] as head}
 <button class:active={current === head} aria-label={head} title={head} onclick={() => { diagram.updateFlowEdge(edge.id, { [end === 'start' ? 'startArrow' : 'endArrow']: head }); arrowMenu = null; }}>{@render arrowIcon(head, end)}</button>
 {/each}
 </div>
 {/if}
 </div>
 {/each}
 </div>

					{:else}
						<div class="option-row connections">
							{#each connectionOptions as option}
								<button class:active={(lineStyle === 'orthogonal' ? edge.routingMode || 'auto' : lineStyle) === option.value} aria-label={option.label} title={option.label} onclick={() => applyConnection(option.value)}><svg viewBox="0 0 24 24"><path d={option.path} /></svg></button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</foreignObject>
</g>
<style>
	.edge-tools .tool-grip { width:15px; flex-shrink:0; cursor:grab; touch-action:none; }
	.edge-tools .tool-grip:active { cursor:grabbing; }
 .arrow-select { flex:1; position:relative; min-width:0; display:flex; flex-direction:column; gap:4px; }
 .arrow-trigger { width:100%; height:27px; display:flex; align-items:center; justify-content:space-between; padding:3px 5px; border:1px solid var(--ui-border); border-radius:5px; color:var(--ui-text); background:var(--ui-bg); cursor:pointer; }
 .arrow-select svg { width:24px; height:20px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
 .arrow-select .chevron { width:10px; height:10px; }
 .arrow-options { position:absolute; top:100%; right:0; margin-top:4px; padding:5px; width:116px; display:grid; grid-template-columns:repeat(4, 26px); gap:2px; background:var(--ui-bg-secondary); border:1px solid var(--ui-border); border-radius:8px; box-shadow:0 3px 10px #0005; }
 .arrow-options button { width:26px; height:27px; min-height:0; min-width:0; padding:1px; background:transparent; border:1px solid transparent; border-radius:4px; color:var(--ui-text-secondary); cursor:pointer; }
 .arrow-options button.active { border-color:var(--ui-accent,#60a5fa); background:var(--ui-bg-tertiary); }

	.connection-menu.compact-shape { width:112px; padding:5px; border-radius:8px; }
	.connections { display:grid !important; grid-template-columns:repeat(4, 23px); gap:2px; margin-top:0; }
	.connections button { width:23px; height:23px; padding:2px; }
	.connections svg { width:17px; height:17px; }
	.setting-row { display:flex; gap:6px; margin-top:6px; }
	.setting-row label { display:flex; flex:1; flex-direction:column; gap:4px; min-width:0; color:var(--ui-text-muted); }
	select, input { width:100%; min-width:0; min-height:0; height:29px; padding:3px 5px; box-sizing:border-box; border:1px solid var(--ui-border); border-radius:5px; background:var(--ui-bg); color:var(--ui-text); font:inherit; }
	.setting-row .color-setting { flex:0 0 34px; }
	input[type='color'] { padding:2px; cursor:pointer; }
	.connection-menu { pointer-events:auto; width:154px; margin-top:7px; padding:8px; box-sizing:border-box; border:1px solid var(--ui-border); border-radius:12px; background:var(--ui-bg-secondary); color:var(--ui-text); box-shadow:0 4px 14px #0005; font-size:11px; }
	.option-row { display:flex; gap:4px; margin-top:6px; }
	.option-row.divided { border-top:1px solid var(--ui-border); padding-top:8px; }
	.option-row button { display:flex; align-items:center; justify-content:center; width:29px; height:29px; min-width:0; min-height:0; padding:4px; border:1px solid transparent; border-radius:5px; background:transparent; color:var(--ui-text-secondary); cursor:pointer; }
	.option-row button:hover { background:var(--ui-bg-tertiary); }
	.option-row button.active { border-color:var(--ui-accent,#60a5fa); background:var(--ui-bg-tertiary); color:var(--ui-text); }
	.option-row svg { width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linejoin:round; stroke-linecap:round; }
 .edge-tools { pointer-events:auto; display:flex; align-items:center; gap:1px; width:95px; height:30px; padding:3px; box-sizing:border-box; border:1px solid var(--ui-border); border-radius:12px; background:var(--ui-bg-secondary); color:var(--ui-text-secondary); box-shadow:0 2px 6px #0003; }
 .edge-tools button { display:flex; align-items:center; justify-content:center; width:23px; height:23px; min-width:0; min-height:0; padding:3px; border:0; border-radius:5px; background:transparent; color:inherit; cursor:pointer; }
 .edge-tools button:hover { background:var(--ui-bg-tertiary); color:var(--ui-text); }
 .edge-tools svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }

</style>
