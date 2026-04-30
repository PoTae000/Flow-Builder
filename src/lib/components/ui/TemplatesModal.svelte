<script lang="ts">
	import { templates } from '$lib/data/templates';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import type { DiagramTemplate } from '$lib/data/templates';

	let { onclose }: { onclose: () => void } = $props();

	let showAll = $state(false);
	const visibleTemplates = $derived(showAll ? templates : templates.slice(0, 4));

	async function applyTemplate(template: DiagramTemplate) {
		const confirmed = await dialog.confirm({
			title: 'ใช้เทมเพลต',
			message: 'ข้อมูลปัจจุบันจะถูกแทนที่ ต้องการดำเนินการต่อหรือไม่?',
			confirmText: 'ใช้เทมเพลต',
			cancelText: 'ยกเลิก',
			variant: 'info'
		});
		if (!confirmed) return;

		diagram.pushHistory('Template');
		diagram.entities = structuredClone(template.entities);
		diagram.relationships = structuredClone(template.relationships);
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	// Mini diagram constants
	const BOX_W = 110;
	const BOX_H = 52;
	const HEADER_H = 18;
	const GAP_X = 55;
	const GAP_Y = 40;
	const PAD = 14;

	function getPreviewLayout(template: DiagramTemplate) {
		const origCenters = template.entities.map(e => ({
			id: e.id,
			ox: e.position.x + 80,
			oy: e.position.y + 50,
		}));

		const xs = origCenters.map(c => c.ox);
		const ys = origCenters.map(c => c.oy);
		const minX = Math.min(...xs), maxX = Math.max(...xs);
		const minY = Math.min(...ys), maxY = Math.max(...ys);
		const rangeX = maxX - minX || 1;
		const rangeY = maxY - minY || 1;
		const spreadX = BOX_W + GAP_X;
		const spreadY = BOX_H + GAP_Y;

		const centers = new Map<string, {x: number, y: number}>();
		for (const c of origCenters) {
			centers.set(c.id, {
				x: PAD + BOX_W / 2 + ((c.ox - minX) / rangeX) * spreadX,
				y: PAD + BOX_H / 2 + ((c.oy - minY) / rangeY) * spreadY,
			});
		}

		const totalW = spreadX + BOX_W + PAD * 2;
		const totalH = spreadY + BOX_H + PAD * 2;
		return { centers, viewBox: `0 0 ${totalW} ${totalH}` };
	}

	// Orthogonal path (no diagonal lines)
	function orthoPath(fc: {x:number,y:number}, tc: {x:number,y:number}): string {
		const dx = tc.x - fc.x;
		const dy = tc.y - fc.y;

		if (Math.abs(dx) >= Math.abs(dy)) {
			// Horizontal-first: exit from sides, Z-path
			const fx = fc.x + (dx > 0 ? BOX_W/2 : -BOX_W/2);
			const fy = fc.y;
			const tx = tc.x + (dx > 0 ? -BOX_W/2 : BOX_W/2);
			const ty = tc.y;
			const midX = (fx + tx) / 2;
			return `M${fx},${fy} L${midX},${fy} L${midX},${ty} L${tx},${ty}`;
		} else {
			// Vertical-first: exit from top/bottom, Z-path
			const fx = fc.x;
			const fy = fc.y + (dy > 0 ? BOX_H/2 : -BOX_H/2);
			const tx = tc.x;
			const ty = tc.y + (dy > 0 ? -BOX_H/2 : BOX_H/2);
			const midY = (fy + ty) / 2;
			return `M${fx},${fy} L${fx},${midY} L${tx},${midY} L${tx},${ty}`;
		}
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/50 animate-fade-in"
	onclick={onclose}
	onkeydown={handleKeydown}
></div>

<!-- Modal -->
<div class="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl animate-scale-in max-sm:landscape:max-h-[calc(100vh-1rem)] max-sm:top-0 max-sm:left-0 max-sm:right-0 max-sm:bottom-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:max-h-none max-sm:w-full max-sm:rounded-none max-sm:border-0">
	<!-- Header -->
	<div class="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-bg)] px-5 py-3">
		<h2 class="text-sm font-normal text-[var(--ui-text)]">เลือกเทมเพลต</h2>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<!-- Card grid -->
	<div class="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 max-sm:landscape:grid-cols-2 max-sm:landscape:gap-2 max-sm:landscape:p-3">
		{#each visibleTemplates as template}
			{@const layout = getPreviewLayout(template)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="cursor-pointer rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 transition hover:border-[var(--ui-text-muted)] hover:shadow-md max-sm:landscape:p-2"
				onclick={() => applyTemplate(template)}
				onkeydown={(e) => { if (e.key === 'Enter') applyTemplate(template); }}
				role="button"
				tabindex="0"
			>
				<!-- Mini ER diagram preview -->
				<svg
					class="mb-2 w-full rounded max-sm:landscape:mb-1"
					style="height: 130px; background: {theme.colors.canvasBg};"
					viewBox={layout.viewBox}
					preserveAspectRatio="xMidYMid meet"
				>
					<!-- Relationship lines (behind entities) -->
					{#each template.relationships as rel}
						{@const fc = layout.centers.get(rel.entityIds[0]) ?? {x:0,y:0}}
						{@const tc = layout.centers.get(rel.entityIds[1]) ?? {x:0,y:0}}
						<path
							d={orthoPath(fc, tc)}
							fill="none"
							stroke={theme.colors.relationshipStroke}
							stroke-width="1.2"
						/>
					{/each}

					<!-- Entity cards -->
					{#each template.entities as entity}
						{@const c = layout.centers.get(entity.id) ?? {x:0,y:0}}
						{@const rx = c.x - BOX_W / 2}
						{@const ry = c.y - BOX_H / 2}
						{@const attrCount = Math.min(entity.attributes.length, 3)}
						<!-- Body -->
						<rect
							x={rx} y={ry}
							width={BOX_W} height={BOX_H}
							rx="4"
							fill={theme.colors.entityFill}
							stroke={theme.colors.entityStroke}
							stroke-width="1.2"
						/>
						<!-- Header band -->
						<rect
							x={rx} y={ry}
							width={BOX_W} height={HEADER_H}
							rx="4"
							fill={theme.colors.entityHeaderFill}
						/>
						<rect
							x={rx} y={ry + HEADER_H - 5}
							width={BOX_W} height="5"
							fill={theme.colors.entityHeaderFill}
						/>
						<!-- Header divider -->
						<line
							x1={rx} y1={ry + HEADER_H}
							x2={rx + BOX_W} y2={ry + HEADER_H}
							stroke={theme.colors.entityStroke}
							stroke-width="0.6"
						/>
						<!-- Entity name -->
						<text
							x={c.x} y={ry + HEADER_H / 2 + 0.5}
							text-anchor="middle"
							dominant-baseline="middle"
							font-size="8.5"
							font-weight="600"
							font-family="system-ui, sans-serif"
							fill={theme.colors.entityHeaderText}
						>{entity.name}</text>
						<!-- Attribute dots -->
						{#each { length: attrCount } as _, i}
							<circle
								cx={rx + 8}
								cy={ry + HEADER_H + 8 + i * 8}
								r="2"
								fill={i === 0 ? theme.colors.pkColor : theme.colors.attrText}
							/>
							<line
								x1={rx + 14} y1={ry + HEADER_H + 8 + i * 8}
								x2={rx + 14 + 25 + (i === 0 ? 12 : i * 8)}
								y2={ry + HEADER_H + 8 + i * 8}
								stroke={i === 0 ? theme.colors.pkColor : theme.colors.attrText}
								stroke-width="1.5"
								stroke-linecap="round"
								opacity="0.5"
							/>
						{/each}
					{/each}
				</svg>

				<h3 class="mb-1 text-sm font-medium text-[var(--ui-text)] max-sm:landscape:text-xs max-sm:landscape:mb-0">{template.name}</h3>
				<p class="mb-2 text-xs leading-relaxed text-[var(--ui-text-muted)] max-sm:landscape:mb-1 max-sm:landscape:text-[10px] max-sm:landscape:leading-snug">{template.description}</p>
				<div class="flex items-center gap-3 text-[10px] text-[var(--ui-text-secondary)] max-sm:landscape:text-[9px]">
					<span class="flex items-center gap-1">
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
						{template.entities.length} เอนทิตี
					</span>
					<span class="flex items-center gap-1">
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
						{template.relationships.length} ความสัมพันธ์
					</span>
				</div>
			</div>
		{/each}
	</div>

	<!-- Show more / Show less -->
	{#if templates.length > 4}
		<div class="border-t border-[var(--ui-border)] px-5 py-3 text-center">
			<button
				class="text-xs text-[var(--ui-text-muted)] transition hover:text-[var(--ui-text)]"
				onclick={() => showAll = !showAll}
			>
				{#if showAll}
					แสดงน้อยลง
				{:else}
					ดูเพิ่มเติม ({templates.length - 4} เทมเพลต)
				{/if}
			</button>
		</div>
	{/if}
</div>
