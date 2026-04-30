<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { exportSvg, exportPng, exportJson, exportErd, exportPdf, exportPdfEnhanced, estimatePdfInfo, generateDiagramThumbnail } from '$lib/utils/export';
	import type { PdfExportOptions } from '$lib/utils/export';
	import { generateMarkdownDocs, generateFlowchartMarkdown, generateDFDMarkdown } from '$lib/utils/docs-generator';
	import { generateShareUrl } from '$lib/utils/share';
	import type { DiagramData } from '$lib/types/session';

	let {
		onclose,
		getSvgElement
	}: {
		onclose: () => void;
		getSvgElement: () => SVGSVGElement | undefined;
	} = $props();

	type TabId = 'erd' | 'png' | 'svg' | 'json' | 'pdf' | 'docs';
	let activeTab = $state<TabId>('erd');
	let pngScale = $state(2);
	let filename = $state('er-diagram');
	let exported = $state(false);
	let exporting = $state(false);
	let pdfPageSize = $state<'a3' | 'a4' | 'letter'>('a4');
	let pdfOrientation = $state<'landscape' | 'portrait'>('landscape');
	const pdfScaleMode = 'auto' as const;
	const pdfMinTextSize = 10;
	const pdfCustomScale = 100;
	let pdfIncludeTitlePage = $state(false);
	let pdfDiagramTitle = $state('');
	let docsPreview = $state('');
	let shareCopied = $state(false);
	let shareGenerating = $state(false);
	let pdfThumbUrl = $state('');

	$effect(() => {
		if (activeTab === 'pdf') {
			const svg = getSvgElement();
			if (svg && !pdfThumbUrl) {
				generateDiagramThumbnail(svg).then(url => { pdfThumbUrl = url; }).catch(() => { pdfThumbUrl = ''; });
			}
		}
	});

	async function handleExportSvg() {
		const svg = getSvgElement();
		if (svg) {
			await exportSvg(svg, `${filename || 'er-diagram'}.svg`, diagram.diagramFont);
			exported = true;
			setTimeout(() => { exported = false; }, 2000);
		}
	}

	async function handleExportPng() {
		const svg = getSvgElement();
		if (svg) {
			await exportPng(svg, `${filename || 'er-diagram'}.png`, pngScale, diagram.diagramFont);
			exported = true;
			setTimeout(() => { exported = false; }, 2000);
		}
	}

	function handleExportJson() {
		const data: DiagramData = {
			entities: $state.snapshot(diagram.entities),
			relationships: $state.snapshot(diagram.relationships),
			notation: diagram.notation,
			diagramFont: diagram.diagramFont,
			panX: diagram.panX,
			panY: diagram.panY,
			zoom: diagram.zoom,
			bookmarks: Array.from(diagram.bookmarks.entries()).map(([slot, b]) => ({
				slot,
				panX: b.panX,
				panY: b.panY,
				zoom: b.zoom
			}))
		};
		exportJson(data, `${filename || 'er-diagram'}.json`);
		exported = true;
		setTimeout(() => { exported = false; }, 2000);
	}

	function handleExportErd() {
		const data: DiagramData = {
			entities: $state.snapshot(diagram.entities),
			relationships: $state.snapshot(diagram.relationships),
			notation: diagram.notation,
			diagramFont: diagram.diagramFont,
			panX: diagram.panX,
			panY: diagram.panY,
			zoom: diagram.zoom,
			bookmarks: Array.from(diagram.bookmarks.entries()).map(([slot, b]) => ({
				slot,
				panX: b.panX,
				panY: b.panY,
				zoom: b.zoom
			}))
		};
		exportErd(data, `${filename || 'diagram'}.erd`);
		exported = true;
		setTimeout(() => { exported = false; }, 2000);
	}

	async function handleExportPdf() {
		const svg = getSvgElement();
		if (svg) {
			const attrCount = diagram.entities.reduce((sum, e) => sum + e.attributes.length, 0);
			const opts: PdfExportOptions = {
				filename: `${filename || 'er-diagram'}.pdf`,
				fontFamily: diagram.diagramFont,
				pageSize: pdfPageSize,
				orientation: pdfOrientation,
				scaleMode: pdfScaleMode,
				minTextSizePt: pdfMinTextSize,
				customScalePercent: pdfCustomScale,
				includeTitlePage: pdfIncludeTitlePage,
				diagramTitle: pdfDiagramTitle || filename || 'ER Diagram',
				diagramType: diagram.diagramType?.toUpperCase() || 'ER',
				notation: diagram.notation,
				entityCount: entityCount,
				relationshipCount: relCount,
				attributeCount: attrCount
			};
			await exportPdfEnhanced(svg, opts);
			exported = true;
			setTimeout(() => { exported = false; }, 2000);
		}
	}

	function handleExportDocs() {
		let md: string;

		if (diagram.diagramType === 'flowchart') {
			md = generateFlowchartMarkdown(
				$state.snapshot(diagram.flowNodes),
				$state.snapshot(diagram.flowEdges)
			);
		} else if (diagram.diagramType === 'context') {
			md = generateDFDMarkdown(
				$state.snapshot(diagram.dfdNodes),
				$state.snapshot(diagram.dfdFlows)
			);
		} else {
			md = generateMarkdownDocs(
				$state.snapshot(diagram.entities),
				$state.snapshot(diagram.relationships)
			);
		}

		const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const defaultName = diagram.diagramType === 'flowchart' ? 'flowchart' :
		                    diagram.diagramType === 'context' ? 'dfd' : 'er-diagram';
		a.download = `${filename || defaultName}.md`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		exported = true;
		setTimeout(() => { exported = false; }, 2000);
	}

	function generatePreview() {
		if (diagram.diagramType === 'flowchart') {
			docsPreview = generateFlowchartMarkdown(
				$state.snapshot(diagram.flowNodes),
				$state.snapshot(diagram.flowEdges)
			);
		} else if (diagram.diagramType === 'context') {
			docsPreview = generateDFDMarkdown(
				$state.snapshot(diagram.dfdNodes),
				$state.snapshot(diagram.dfdFlows)
			);
		} else {
			docsPreview = generateMarkdownDocs(
				$state.snapshot(diagram.entities),
				$state.snapshot(diagram.relationships)
			);
		}
	}

	async function handleExport() {
		exporting = true;
		try {
			if (activeTab === 'erd') handleExportErd();
			else if (activeTab === 'svg') await handleExportSvg();
			else if (activeTab === 'png') await handleExportPng();
			else if (activeTab === 'json') handleExportJson();
			else if (activeTab === 'pdf') await handleExportPdf();
			else if (activeTab === 'docs') handleExportDocs();
		} finally {
			exporting = false;
		}
	}

	async function handleShareLink() {
		shareGenerating = true;
		try {
			const data: DiagramData = {
				entities: $state.snapshot(diagram.entities),
				relationships: $state.snapshot(diagram.relationships),
				notes: $state.snapshot(diagram.notes),
				notation: diagram.notation,
				diagramFont: diagram.diagramFont,
				panX: 0,
				panY: 0,
				zoom: 1
			};
			const url = await generateShareUrl(data);
			await navigator.clipboard.writeText(url);
			shareCopied = true;
			setTimeout(() => { shareCopied = false; }, 3000);
		} finally {
			shareGenerating = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	const tabs: { id: TabId; label: string; desc: string }[] = [
		{ id: 'erd', label: 'ERD', desc: 'ไฟล์โปรเจกต์ — เปิดกลับมาแก้ไขต่อได้ (แนะนำ)' },
		{ id: 'png', label: 'PNG', desc: 'รูปภาพ PNG' },
		{ id: 'svg', label: 'SVG', desc: 'กราฟิกเวกเตอร์' },
		{ id: 'pdf', label: 'PDF', desc: 'เอกสาร PDF' },
		{ id: 'json', label: 'JSON', desc: 'ข้อมูล JSON ดิบ' },
		{ id: 'docs', label: 'Docs', desc: 'เอกสาร Markdown (.md)' }
	];

	const scaleOptions = [
		{ value: 1, label: '1x (ปกติ)' },
		{ value: 2, label: '2x (แนะนำ)' },
		{ value: 3, label: '3x (คมชัดสูง)' },
		{ value: 4, label: '4x (พิมพ์)' }
	];

	const entityCount = $derived(diagram.entities.length);
	const relCount = $derived(diagram.relationships.length);
	const attrCount = $derived(diagram.entities.reduce((sum, e) => sum + e.attributes.length, 0));

	const previewPageDims = $derived.by(() => {
		const sizes: Record<string, [number, number]> = {
			a3: [841.89, 1190.55],
			a4: [595.28, 841.89],
			letter: [612, 792]
		};
		const sizeScale: Record<string, number> = { a3: 1.3, a4: 1, letter: 1 };
		const [short, long] = sizes[pdfPageSize] || sizes.a4;
		const w = pdfOrientation === 'landscape' ? long : short;
		const h = pdfOrientation === 'landscape' ? short : long;
		const totalPages = pdfInfo.pages;
		const baseH = (totalPages > 3 ? 100 : 140) * (sizeScale[pdfPageSize] ?? 1);
		return { w: Math.round(baseH * (w / h)), h: Math.round(baseH) };
	});

	const pageSizeLabel = $derived(
		pdfPageSize === 'a4' ? 'A4' : pdfPageSize === 'a3' ? 'A3' : 'Letter'
	);
	const orientationLabel = $derived(
		pdfOrientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'
	);

	const pdfInfo = $derived.by(() => {
		const svg = getSvgElement();
		if (!svg) return { pages: 1, textPt: 10, cols: 1, rows: 1 };
		return estimatePdfInfo(svg, {
			pageSize: pdfPageSize,
			orientation: pdfOrientation,
			scaleMode: pdfScaleMode,
			minTextSizePt: pdfMinTextSize,
			customScalePercent: pdfCustomScale,
			includeTitlePage: pdfIncludeTitlePage
		});
	});
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/50 animate-fade-in"
	onclick={onclose}
	onkeydown={handleKeydown}
></div>

<!-- Modal -->
<div class="fixed left-1/2 top-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl animate-scale-in transition-[width] duration-200 ease-out {activeTab === 'pdf' ? 'w-[720px]' : 'w-[420px]'}">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<h2 class="text-sm font-normal text-[var(--ui-text)]">ส่งออก Diagram</h2>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<div class="max-h-[calc(100vh-6rem)] overflow-y-auto p-5">
		<!-- Summary + Share link -->
		<div class="mb-4 flex items-center justify-between rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2">
			<span class="text-xs text-[var(--ui-text-secondary)]">{entityCount} เอนทิตี, {relCount} ความสัมพันธ์</span>
			<button
				onclick={handleShareLink}
				disabled={shareGenerating || entityCount === 0}
				class="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition {shareCopied
					? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
					: 'bg-[var(--ui-bg)] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text)] border border-[var(--ui-border)]'} disabled:opacity-50"
			>
				{#if shareCopied}
					<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
					คัดลอกแล้ว!
				{:else if shareGenerating}
					<svg class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
					กำลังสร้าง...
				{:else}
					<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>
					คัดลอกลิงก์แชร์
				{/if}
			</button>
		</div>

		<!-- Tab selection -->
		<div class="mb-4 flex gap-1 rounded-lg bg-[var(--ui-bg-secondary)] p-1">
			{#each tabs as tab}
				<button
					onclick={() => { activeTab = tab.id; exported = false; }}
					class="flex-1 rounded-md px-3 py-1.5 text-xs transition {activeTab === tab.id
						? 'bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-sm'
						: 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Tab description -->
		<p class="mb-3 text-xs text-[var(--ui-text-muted)]">
			{tabs.find(t => t.id === activeTab)?.desc}
		</p>

		<!-- Filename -->
		<div class="mb-3">
			<span class="mb-1 block text-xs text-[var(--ui-text-muted)]">ชื่อไฟล์</span>
			<div class="flex items-center gap-0">
				<input
					type="text"
					bind:value={filename}
					class="min-w-0 flex-1 rounded-l border border-r-0 border-[var(--ui-border)] bg-[var(--ui-bg)] px-2.5 py-1.5 text-xs text-[var(--ui-text)] focus:ring-1 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
				/>
				<span class="rounded-r border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1.5 text-xs text-[var(--ui-text-muted)]">
					.{activeTab === 'erd' ? 'erd' : activeTab === 'docs' ? 'md' : activeTab}
				</span>
			</div>
		</div>

		<!-- PNG scale option -->
		{#if activeTab === 'png'}
			<div class="mb-3">
				<span class="mb-1 block text-xs text-[var(--ui-text-muted)]">ความละเอียด</span>
				<div class="flex gap-1.5">
					{#each scaleOptions as opt}
						<button
							onclick={() => pngScale = opt.value}
							class="flex-1 rounded border px-2 py-1.5 text-[10px] transition {pngScale === opt.value
								? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)]'
								: 'border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:border-[var(--ui-text-muted)]'}"
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- PDF options (split layout) -->
		{#if activeTab === 'pdf'}
			<div class="flex flex-col sm:flex-row gap-4">
				<!-- Left: Options -->
				<div class="w-full sm:w-[260px] sm:shrink-0">
					<!-- Page size + Orientation -->
					<div class="mb-3 flex gap-3">
						<div class="flex-1">
							<span class="mb-1 block text-xs text-[var(--ui-text-muted)]">ขนาดกระดาษ</span>
							<div class="flex gap-1.5">
								{#each [['a4', 'A4'], ['a3', 'A3'], ['letter', 'Letter']] as [val, label]}
									<button
										onclick={() => pdfPageSize = val as 'a3' | 'a4' | 'letter'}
										class="flex-1 rounded border px-2 py-1.5 text-[10px] transition {pdfPageSize === val
											? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)]'
											: 'border-[var(--ui-border)] text-[var(--ui-text-muted)]'}"
									>{label}</button>
								{/each}
							</div>
						</div>
						<div class="flex-1">
							<span class="mb-1 block text-xs text-[var(--ui-text-muted)]">แนว</span>
							<div class="flex gap-1.5">
								<button
									onclick={() => pdfOrientation = 'landscape'}
									class="flex-1 rounded border px-2 py-1.5 text-[10px] transition {pdfOrientation === 'landscape'
										? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)]'
										: 'border-[var(--ui-border)] text-[var(--ui-text-muted)]'}"
								>แนวนอน</button>
								<button
									onclick={() => pdfOrientation = 'portrait'}
									class="flex-1 rounded border px-2 py-1.5 text-[10px] transition {pdfOrientation === 'portrait'
										? 'border-[var(--ui-text-secondary)] bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)]'
										: 'border-[var(--ui-border)] text-[var(--ui-text-muted)]'}"
								>แนวตั้ง</button>
							</div>
						</div>
					</div>

					<!-- Title page -->
					<div class="mb-3">
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								bind:checked={pdfIncludeTitlePage}
								class="h-3.5 w-3.5 rounded border-[var(--ui-border)] accent-[var(--ui-accent)]"
							/>
							<span class="text-xs text-[var(--ui-text-secondary)]">รวมหน้าปก</span>
						</label>
						{#if pdfIncludeTitlePage}
							<input
								type="text"
								bind:value={pdfDiagramTitle}
								placeholder="ชื่อ Diagram (ไม่ระบุ = ใช้ชื่อไฟล์)"
								class="mt-1.5 w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2.5 py-1.5 text-xs text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:ring-1 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
							/>
						{/if}
					</div>

					<!-- Page info (visible on mobile where preview is below) -->
					<div class="mb-3 text-[10px] text-[var(--ui-text-muted)]">
						{pdfInfo.pages} หน้า · ~{pdfInfo.textPt}pt
						{#if pdfInfo.cols > 1 || pdfInfo.rows > 1}
							· {pdfInfo.cols}×{pdfInfo.rows} แผ่น
						{/if}
					</div>
				</div>

				<!-- Right: Preview -->
				<div class="flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3 overflow-auto max-h-[360px]">
					<div class="mb-2 text-[10px] text-[var(--ui-text-muted)]">
						{pageSizeLabel} {orientationLabel} · {pdfInfo.pages} หน้า · ~{pdfInfo.textPt}pt
					</div>
					<div class="flex flex-wrap gap-3 justify-center">
						{#each Array(pdfInfo.pages) as _, i}
							{@const isTitle = pdfIncludeTitlePage && i === 0}
							{@const tileIdx = i - (pdfIncludeTitlePage ? 1 : 0)}
							{@const tileCol = isTitle ? 0 : tileIdx % pdfInfo.cols}
							{@const tileRow = isTitle ? 0 : Math.floor(tileIdx / pdfInfo.cols)}
							{@const pw = previewPageDims.w}
							{@const ph = previewPageDims.h}
							{@const contentW = pw - 8}
							{@const contentH = ph - 18}
							<div class="flex flex-col items-center gap-1">
								<div class="relative shrink-0 overflow-hidden rounded border border-[var(--ui-border)] bg-white shadow-sm transition-all duration-150 hover:border-[var(--ui-text-muted)] hover:shadow-md hover:scale-[1.03]"
									style="width: {pw}px; height: {ph}px;">
									{#if isTitle}
										<div class="flex h-full flex-col items-center justify-center gap-1">
											<div class="h-[1px] w-6 bg-gray-300"></div>
											<span class="text-[8px] text-gray-400">Title</span>
											<div class="h-[1px] w-4 bg-gray-200"></div>
										</div>
									{:else if pdfThumbUrl}
										<!-- Header line -->
										<div class="mx-1 mt-1 h-[1px] bg-gray-200"></div>
										<!-- Diagram tile portion -->
										<div class="mx-1 mt-1 overflow-hidden" style="width: {contentW}px; height: {contentH}px;">
											<img
												src={pdfThumbUrl}
												alt=""
												class="block"
												style="width: {contentW * pdfInfo.cols}px; height: {contentH * pdfInfo.rows}px; margin-left: {-contentW * tileCol}px; margin-top: {-contentH * tileRow}px; object-fit: fill;"
											/>
										</div>
										<!-- Footer line -->
										<div class="mx-1 mt-[2px] h-[1px] bg-gray-200"></div>
									{:else}
										<div class="flex h-full items-center justify-center">
											<div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400"></div>
										</div>
									{/if}
								</div>
								<span class="text-[8px] text-[var(--ui-text-muted)]">{i + 1}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Docs preview -->
		{#if activeTab === 'docs'}
			<div class="mb-3">
				<button
					onclick={generatePreview}
					class="mb-2 text-xs text-[var(--ui-accent)] hover:underline"
				>แสดงตัวอย่าง</button>
				{#if docsPreview}
					<pre class="max-h-40 overflow-auto rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-2 text-[10px] text-[var(--ui-text-secondary)]">{docsPreview}</pre>
				{/if}
			</div>
		{/if}

		<!-- Export button -->
		<button
			onclick={handleExport}
			disabled={exporting}
			class="mt-4 flex w-full items-center justify-center gap-2 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-60"
		>
			{#if exporting}
				<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
				กำลังส่งออก...
			{:else if exported}
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
				ดาวน์โหลดแล้ว!
			{:else}
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
				ส่งออก {activeTab.toUpperCase()}
			{/if}
		</button>
	</div>
</div>
