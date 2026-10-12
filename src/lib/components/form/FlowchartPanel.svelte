<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import type { FlowNodeType } from '$lib/types/flowchart';

	let nodeType = $state<FlowNodeType>('process');


	const shapeCategories: { name: string; shapes: { type: FlowNodeType; label: string }[] }[] = [
		{
			name: 'ผังงาน',
			shapes: [
				{ type: 'process', label: 'Process' },
				{ type: 'decision', label: 'Decision' },
				{ type: 'start-end', label: 'Terminator' },
				{ type: 'connector', label: 'Connector' },
				{ type: 'document', label: 'Document' },
				{ type: 'predefined-process', label: 'Predef.' },
				{ type: 'manual-operation', label: 'Manual Op' },
				{ type: 'manual-input', label: 'Manual In' },
				{ type: 'preparation', label: 'Prepare' },
				{ type: 'delay', label: 'Delay' },
				{ type: 'display', label: 'Display' },
				{ type: 'off-page-connector', label: 'Off-page' },
				{ type: 'merge', label: 'Merge' },
				{ type: 'extract', label: 'Extract' },
				{ type: 'or', label: 'Or' },
				{ type: 'summing-junction', label: 'Sum' },
				{ type: 'card', label: 'Card' }
			]
		},
		{
			name: 'ทั่วไป',
			shapes: [
				{ type: 'process', label: 'Rectangle' },
				{ type: 'start-end', label: 'Rounded' },
				{ type: 'ellipse', label: 'Ellipse' },
				{ type: 'square', label: 'Square' },
				{ type: 'circle', label: 'Circle' },
				{ type: 'triangle', label: 'Triangle' },
				{ type: 'decision', label: 'Diamond' },
				{ type: 'trapezoid', label: 'Trapezoid' },
				{ type: 'input-output', label: 'Parallelogram' },
				{ type: 'step', label: 'Step' },
				{ type: 'callout', label: 'Callout' },
				{ type: 'cloud', label: 'Cloud' }
			]
		},
		{
			name: 'ข้อมูล',
			shapes: [
				{ type: 'database', label: 'Database' },
				{ type: 'internal-storage', label: 'Storage' },
				{ type: 'stored-data', label: 'Stored Data' },
				{ type: 'tape', label: 'Tape' }
			]
		},
		{
			name: 'เบ็ดเตล็ด',
			shapes: [
				{ type: 'star', label: 'Star' },
				{ type: 'cross', label: 'Cross' }
			]
		},
		{
			name: 'ลูกศร',
			shapes: [
				{ type: 'arrow-right', label: 'ขวา' },
				{ type: 'arrow-left', label: 'ซ้าย' },
				{ type: 'arrow-up', label: 'ขึ้น' },
				{ type: 'arrow-down', label: 'ลง' },
				{ type: 'arrow-bidirectional', label: 'สองทาง' }
			]
		},
		{
			name: 'UML',
			shapes: [
				{ type: 'uml-class', label: 'Class' },
				{ type: 'uml-actor', label: 'Actor' },
				{ type: 'uml-note', label: 'Note' },
				{ type: 'uml-package', label: 'Package' },
				{ type: 'uml-component', label: 'Component' }
			]
		}
	];


	let openCats = $state<Record<string, boolean>>({ 'ผังงาน': true });

	function toggleCat(name: string) {
		openCats[name] = !openCats[name];
	}


	let touchDrag = $state<{ type: FlowNodeType; label: string; x: number; y: number } | null>(null);
	let touchStart: { x: number; y: number } | null = null;
	let touchMoved = $state(false);

	function handleShapeTouchStart(e: TouchEvent, opt: { type: FlowNodeType; label: string }) {
		const t = e.touches[0];
		touchStart = { x: t.clientX, y: t.clientY };
		touchMoved = false;
		touchDrag = { type: opt.type, label: opt.label, x: t.clientX, y: t.clientY };
	}

	function handleShapeTouchMove(e: TouchEvent) {
		if (!touchDrag || !touchStart) return;
		const t = e.touches[0];
		if (!touchMoved && Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > 6) {
			touchMoved = true;
		}
		if (touchMoved) e.preventDefault();
		touchDrag = { ...touchDrag, x: t.clientX, y: t.clientY };
	}

	function handleShapeTouchEnd(e: TouchEvent) {
		const drag = touchDrag;
		touchDrag = null;
		touchStart = null;
		if (!drag || !touchMoved) return;
		const t = e.changedTouches[0];

		const el = document.elementFromPoint(t.clientX, t.clientY);
		const svg = el?.closest('svg[data-onboarding="canvas"]') as SVGSVGElement | null;
		if (!svg) return;
		const rect = svg.getBoundingClientRect();
		const pos = {
			x: (t.clientX - rect.left - diagram.panX) / diagram.zoom,
			y: (t.clientY - rect.top - diagram.panY) / diagram.zoom
		};
		diagram.addFlowNode('', drag.type, pos);
	}

</script>

{#snippet shapeIcon(type: FlowNodeType, size: number)}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		{#if type === 'process'}
			<rect x="3" y="6" width="18" height="12" rx="1" />
		{:else if type === 'decision'}
			<polygon points="12,3 22,12 12,21 2,12" />
		{:else if type === 'start-end'}
			<rect x="3" y="6" width="18" height="12" rx="6" />
		{:else if type === 'input-output'}
			<polygon points="6,6 22,6 18,18 2,18" />
		{:else if type === 'connector'}
			<circle cx="12" cy="12" r="8" />
		{:else if type === 'document'}
			<path d="M3,6 h18 v9 q-4.5,3 -9,0 q-4.5,-3 -9,0 Z" />
		{:else if type === 'database'}
			<path d="M3,8 a9,3 0 0,1 18,0 v8 a9,3 0 0,1 -18,0 Z" />
			<ellipse cx="12" cy="8" rx="9" ry="3" />
		{:else if type === 'predefined-process'}
			<rect x="3" y="6" width="18" height="12" rx="1" />
			<line x1="6" y1="6" x2="6" y2="18" />
			<line x1="18" y1="6" x2="18" y2="18" />
		{:else if type === 'manual-operation'}
			<polygon points="3,6 21,6 18,18 6,18" />
		{:else if type === 'preparation'}
			<polygon points="7,6 17,6 22,12 17,18 7,18 2,12" />
		{:else if type === 'delay'}
			<path d="M3,6 h12 a6,6 0 0,1 0,12 h-12 Z" />
		{:else if type === 'display'}
			<path d="M7,6 h8 a6,6 0 0,1 0,12 h-8 l-4,-6 Z" />
		{:else if type === 'internal-storage'}
			<rect x="3" y="6" width="18" height="12" rx="1" />
			<line x1="7" y1="6" x2="7" y2="18" />
			<line x1="3" y1="10" x2="21" y2="10" />
		{:else if type === 'manual-input'}
			<polygon points="3,9 21,6 21,18 3,18" />
		{:else if type === 'off-page-connector'}
			<polygon points="4,4 20,4 20,14 12,20 4,14" />
		{:else if type === 'merge'}
			<polygon points="3,5 21,5 12,19" />
		{:else if type === 'extract'}
			<polygon points="12,5 21,19 3,19" />
		{:else if type === 'or'}
			<circle cx="12" cy="12" r="8" />
			<line x1="4" y1="12" x2="20" y2="12" />
			<line x1="12" y1="4" x2="12" y2="20" />
		{:else if type === 'summing-junction'}
			<circle cx="12" cy="12" r="8" />
			<line x1="6.3" y1="6.3" x2="17.7" y2="17.7" />
			<line x1="6.3" y1="17.7" x2="17.7" y2="6.3" />
		{:else if type === 'stored-data'}
			<path d="M6,4 h13 q-3,8 0,16 h-13 q3,-8 0,-16 Z" />
		{:else if type === 'ellipse'}
			<ellipse cx="12" cy="12" rx="10" ry="6" />
		{:else if type === 'circle'}
			<circle cx="12" cy="12" r="8" />
		{:else if type === 'square'}
			<rect x="5" y="5" width="14" height="14" rx="1" />
		{:else if type === 'triangle'}
			<polygon points="12,4 21,20 3,20" />
		{:else if type === 'trapezoid'}
			<polygon points="7,6 17,6 21,18 3,18" />
		{:else if type === 'cloud'}
			<path d="M7,17 a4,4 0 0,1 -1,-8 a4,4 0 0,1 7,-2 a4,4 0 0,1 4,4 a3,3 0 0,1 -1,6 Z" />
		{:else if type === 'callout'}
			<path d="M3,4 h18 v10 h-7 l-3,5 l-2,-5 h-6 Z" />
		{:else if type === 'card'}
			<polygon points="8,4 21,4 21,20 3,20 3,9" />
		{:else if type === 'step'}
			<polygon points="3,5 18,5 21,12 18,19 3,19 6,12" />
		{:else if type === 'star'}
			<polygon points="12,3 14.5,9 21,9 15.5,13 17.5,20 12,16 6.5,20 8.5,13 3,9 9.5,9" />
		{:else if type === 'cross'}
			<polygon points="9,3 15,3 15,9 21,9 21,15 15,15 15,21 9,21 9,15 3,15 3,9 9,9" />
		{:else if type === 'tape'}
			<path d="M3,6 q4.5,-3 9,0 q4.5,3 9,0 v12 q-4.5,3 -9,0 q-4.5,-3 -9,0 Z" />
		{:else if type === 'arrow-right'}
			<polygon points="3,9 15,9 15,6 21,12 15,18 15,15 3,15" />
		{:else if type === 'arrow-left'}
			<polygon points="21,9 9,9 9,6 3,12 9,18 9,15 21,15" />
		{:else if type === 'arrow-up'}
			<polygon points="9,21 9,9 6,9 12,3 18,9 15,9 15,21" />
		{:else if type === 'arrow-down'}
			<polygon points="9,3 9,15 6,15 12,21 18,15 15,15 15,3" />
		{:else if type === 'arrow-bidirectional'}
			<polygon points="2,12 7,7 7,10 17,10 17,7 22,12 17,17 17,14 7,14 7,17" />
		{:else if type === 'uml-class'}
			<rect x="4" y="4" width="16" height="16" rx="1" />
			<line x1="4" y1="9" x2="20" y2="9" />
			<line x1="4" y1="14" x2="20" y2="14" />
		{:else if type === 'uml-actor'}
			<circle cx="12" cy="5" r="2.5" />
			<line x1="12" y1="7.5" x2="12" y2="15" />
			<line x1="7" y1="10" x2="17" y2="10" />
			<line x1="12" y1="15" x2="8" y2="21" />
			<line x1="12" y1="15" x2="16" y2="21" />
		{:else if type === 'uml-note'}
			<path d="M4,4 h11 l5,5 v11 h-16 Z" />
			<path d="M15,4 v5 h5" />
		{:else if type === 'uml-package'}
			<path d="M3,8 h7 v-3 h11 v14 h-18 Z" />
		{:else if type === 'uml-component'}
			<rect x="6" y="4" width="14" height="16" rx="1" />
			<rect x="3" y="8" width="5" height="3" />
			<rect x="3" y="14" width="5" height="3" />
		{/if}
	</svg>
{/snippet}

<div class="flex flex-col gap-5">

	<div class="flex flex-col gap-2">
		<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">เพิ่ม Node</span>


		<div class="flex flex-col gap-1 rounded-lg border border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] p-1">
			{#each shapeCategories as cat}
				<div class="flex flex-col">
					<button
						onclick={() => toggleCat(cat.name)}
						class="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-bg-tertiary)]"
						aria-expanded={!!openCats[cat.name]}
					>
						<svg class="h-3 w-3 shrink-0 transition-transform {openCats[cat.name] ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
						</svg>
						<span>{cat.name}</span>
						<span class="ml-auto text-[10px] text-[var(--ui-text-muted)]">{cat.shapes.length}</span>
					</button>
					{#if openCats[cat.name]}
						<div class="grid grid-cols-4 gap-1 px-1 pb-1.5 pt-0.5">
							{#each cat.shapes as opt}
								<button
									onclick={() => {
										nodeType = opt.type;
										// Toggle Draw.io-style stamp mode: click shape → click canvas to place.
										diagram.stampShape = diagram.stampShape === opt.type ? null : opt.type;
									}}
									draggable="true"
									ondragstart={(e) => {
										e.dataTransfer?.setData('application/x-flow-shape', opt.type);
										if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
										nodeType = opt.type;
										diagram.stampShape = null; // dragging is its own gesture
									}}
									ontouchstart={(e) => handleShapeTouchStart(e, opt)}
									ontouchmove={handleShapeTouchMove}
									ontouchend={handleShapeTouchEnd}
									style="touch-action: none;"
									class="flex cursor-grab flex-col items-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-[10px] transition active:cursor-grabbing {diagram.stampShape === opt.type ? 'border-[var(--ui-accent,var(--ui-text-secondary))] bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)] ring-2 ring-[var(--ui-text-secondary)]' : nodeType === opt.type ? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)]' : 'border-[var(--ui-border-light)] bg-[var(--ui-bg)] text-[var(--ui-text-muted)] hover:border-[var(--ui-border)]'}"
									aria-label="Select {opt.label} shape"
									title="{opt.label} — คลิกเลือกเพื่อวาง แล้วคลิกบนพื้นที่วาด หรือจะลากไปวางก็ได้"
								>
									{@render shapeIcon(opt.type, 20)}
									<span class="truncate max-w-full">{opt.label}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if diagram.stampShape}
			<div class="flex items-center justify-between gap-2 rounded-lg border border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)] px-2.5 py-1.5 text-[11px] text-[var(--ui-text)]">
				<span>คลิกบนพื้นที่วาดเพื่อวาง Node (คลิกได้หลายครั้ง)</span>
				<button
					onclick={() => (diagram.stampShape = null)}
					class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]"
					title="ออกจากโหมดวาง (Esc)"
				>
					ยกเลิก (Esc)
				</button>
			</div>
		{:else}
			<p class="text-[11px] leading-relaxed text-[var(--ui-text-muted)]">
				คลิกรูปทรงเพื่อเลือก แล้วคลิกบนพื้นที่วาด หรือจะลากไปวางก็ได้
			</p>
		{/if}
	</div>


</div>


{#if touchDrag && touchMoved}
	<div
		class="pointer-events-none fixed z-[60] flex flex-col items-center gap-0.5 rounded-lg border border-[var(--ui-text-secondary)] bg-[var(--ui-bg)] px-3 py-2 text-[10px] text-[var(--ui-text)] opacity-90 shadow-2xl"
		style="left: {touchDrag.x}px; top: {touchDrag.y}px; transform: translate(-50%, -50%);"
	>
		{@render shapeIcon(touchDrag.type, 28)}
		<span>{touchDrag.label}</span>
	</div>
{/if}
