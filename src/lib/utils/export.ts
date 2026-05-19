import { diagram } from '$lib/stores/diagram.svelte';

const EXPORT_PADDING = 40;

// Font embedding cache — keyed by font family so switching fonts works correctly
const fontCssCache = new Map<string, string>();

/**
 * Fetch Google Fonts CSS from a URL, download each woff2 file,
 * convert to base64 data URI, and return self-contained CSS.
 */
async function fetchAndEmbedFontCss(cssUrl: string): Promise<string> {
	try {
		const cssRes = await fetch(cssUrl, {
			headers: {
				// Chrome user-agent to get woff2 format
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'
			}
		});

		if (!cssRes.ok) return '';
		let css = await cssRes.text();

		// Find all url(...) references and replace with base64 data URIs
		const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
		const urls = new Set<string>();
		let match;
		while ((match = urlRegex.exec(css)) !== null) {
			urls.add(match[1]);
		}

		for (const fontUrl of urls) {
			try {
				const fontRes = await fetch(fontUrl);
				if (!fontRes.ok) continue;
				const buffer = await fontRes.arrayBuffer();
				const base64 = arrayBufferToBase64(buffer);
				const mimeType = fontUrl.includes('.woff2') ? 'font/woff2' : 'font/woff';
				const dataUri = `data:${mimeType};base64,${base64}`;
				css = css.replaceAll(fontUrl, dataUri);
			} catch {
				// Skip failed font files
			}
		}

		return css;
	} catch {
		return '';
	}
}

/**
 * Fetch Google Fonts CSS, download each woff2 file,
 * convert to base64 data URI, and return self-contained CSS.
 */
async function getEmbeddedFontCss(fontFamily: string): Promise<string> {
	const cached = fontCssCache.get(fontFamily);
	if (cached) return cached;

	// Evict oldest entry to prevent unbounded growth in long sessions
	if (fontCssCache.size >= 20) {
		const firstKey = fontCssCache.keys().next().value;
		if (firstKey) fontCssCache.delete(firstKey);
	}

	// Check if fontFamily matches a custom font — use its stored URL directly
	const customFont = diagram.customFonts.find(f => fontFamily.includes(f.label));
	if (customFont) {
		const css = await fetchAndEmbedFontCss(customFont.url);
		if (css) {
			fontCssCache.set(fontFamily, css);
			return css;
		}
	}

	try {
		// Determine which Google Font to load based on diagram font setting
		let fontName = 'Sarabun';
		if (fontFamily.includes('Kanit')) fontName = 'Kanit';
		else if (fontFamily.includes('Prompt')) fontName = 'Prompt';
		else if (fontFamily.includes('Noto Sans Thai')) fontName = 'Noto+Sans+Thai';
		else if (fontFamily.includes('Sarabun')) fontName = 'Sarabun';
		else {
			// Try to extract font name from CSS value like "'FontName', sans-serif"
			const nameMatch = fontFamily.match(/'([^']+)'/);
			if (nameMatch) fontName = nameMatch[1].replace(/\s+/g, '+');
		}

		// Fetch CSS from Google Fonts (woff2 format via user-agent)
		const cssUrl = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;700&display=swap`;
		const css = await fetchAndEmbedFontCss(cssUrl);

		fontCssCache.set(fontFamily, css);
		return css;
	} catch {
		return '';
	}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Prepare SVG clone for export: compute content bounding box,
 * set explicit width/height/viewBox, flatten transform, white background.
 */
function prepareExportSvg(svgEl: SVGSVGElement, embeddedFontCss: string): { clone: SVGSVGElement; width: number; height: number } {
	const clone = svgEl.cloneNode(true) as SVGSVGElement;

	// Find the transform group (contains all diagram content)
	const transformGroup = clone.querySelector('g[transform]');

	if (transformGroup) {
		const fontFamily = transformGroup.getAttribute('font-family');
		transformGroup.removeAttribute('transform');
		if (fontFamily) {
			transformGroup.setAttribute('font-family', fontFamily);
		}
	}

	// Embed font CSS as base64 data URIs into SVG <defs>
	if (embeddedFontCss) {
		const defs = clone.querySelector('defs');
		if (defs) {
			const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
			style.textContent = embeddedFontCss;
			// @ts-ignore — SVGStyleElement is a valid Node for prepend in DOM
			defs.prepend(style);
		}
	}

	// Compute bounding box from entity/relationship positions
	const origGroup = svgEl.querySelector('g[transform]');
	let contentBBox = { x: 0, y: 0, width: 800, height: 600 };

	if (origGroup) {
		try {
			const bbox = (origGroup as SVGGraphicsElement).getBBox();
			if (bbox.width > 0 && bbox.height > 0) {
				contentBBox = bbox;
			}
		} catch {
			// getBBox can fail if element is not rendered
		}
	}

	const width = contentBBox.width + EXPORT_PADDING * 2;
	const height = contentBBox.height + EXPORT_PADDING * 2;

	clone.setAttribute('width', String(Math.ceil(width)));
	clone.setAttribute('height', String(Math.ceil(height)));
	clone.setAttribute('viewBox', `${contentBBox.x - EXPORT_PADDING} ${contentBBox.y - EXPORT_PADDING} ${width} ${height}`);

	clone.removeAttribute('class');
	clone.style.background = '';

	// Remove hidden measurement paths (from DataFlowParticles)
	clone.querySelectorAll('path[style*="display: none"]').forEach(p => p.remove());

	const bgRect = clone.querySelector('.canvas-bg');
	if (bgRect) {
		bgRect.setAttribute('fill', '#ffffff');
		bgRect.setAttribute('x', String(contentBBox.x - EXPORT_PADDING));
		bgRect.setAttribute('y', String(contentBBox.y - EXPORT_PADDING));
		bgRect.setAttribute('width', String(width));
		bgRect.setAttribute('height', String(height));
	}

	return { clone, width: Math.ceil(width), height: Math.ceil(height) };
}

export async function exportSvg(svgEl: SVGSVGElement, filename: string = 'er-diagram.svg', fontFamily: string = 'Sarabun') {
	const fontCss = await getEmbeddedFontCss(fontFamily);
	const { clone } = prepareExportSvg(svgEl, fontCss);

	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(clone);
	const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });

	downloadBlob(blob, filename);
}

export async function exportPng(svgEl: SVGSVGElement, filename: string = 'er-diagram.png', scale: number = 2, fontFamily: string = 'Sarabun') {
	const fontCss = await getEmbeddedFontCss(fontFamily);
	const { clone, width, height } = prepareExportSvg(svgEl, fontCss);

	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(clone);

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const img = new Image();
	const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(svgBlob);

	img.onload = () => {
		canvas.width = width * scale;
		canvas.height = height * scale;
		ctx.scale(scale, scale);
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, width, height);
		ctx.drawImage(img, 0, 0, width, height);
		URL.revokeObjectURL(url);

		canvas.toBlob((blob) => {
			if (blob) downloadBlob(blob, filename);
		}, 'image/png');
	};

	img.onerror = () => {
		URL.revokeObjectURL(url);
	};

	img.src = url;
}

export function exportJson(data: object, filename: string = 'er-diagram.json') {
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
	downloadBlob(blob, filename);
}

/** Export diagram as .erd file (custom format) */
export function exportErd(data: object, filename: string = 'diagram.erd') {
	const erdData = {
		format: 'er-diagram-builder',
		version: 1,
		exportedAt: new Date().toISOString(),
		...data
	};
	const json = JSON.stringify(erdData, null, 2);
	const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
	downloadBlob(blob, filename);
}

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMPORT_ENTITIES = 500;
const MAX_IMPORT_RELATIONSHIPS = 1000;

/** Validate imported diagram data for schema + size limits */
function validateDiagramImport(data: unknown): data is Record<string, unknown> {
	if (!data || typeof data !== 'object') return false;
	const d = data as Record<string, unknown>;
	if (d.entities !== undefined && Array.isArray(d.entities)) {
		if (d.entities.length > MAX_IMPORT_ENTITIES) return false;
	}
	if (d.relationships !== undefined && Array.isArray(d.relationships)) {
		if (d.relationships.length > MAX_IMPORT_RELATIONSHIPS) return false;
	}
	return true;
}

/** Import .erd file */
export function importErd(): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.erd,.json';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return reject(new Error('No file selected'));
			if (file.size > MAX_IMPORT_FILE_SIZE) return reject(new Error('ไฟล์ใหญ่เกินไป (สูงสุด 10MB)'));
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const data = JSON.parse(reader.result as string);
					if (!validateDiagramImport(data)) {
						return reject(new Error('ข้อมูลเกินขีดจำกัด (entities ≤ 500, relationships ≤ 1000)'));
					}
					resolve(data);
				} catch {
					reject(new Error('ไฟล์ไม่ถูกต้อง'));
				}
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsText(file);
		};
		input.click();
	});
}

export function importJson(): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return reject(new Error('No file selected'));
			if (file.size > MAX_IMPORT_FILE_SIZE) return reject(new Error('ไฟล์ใหญ่เกินไป (สูงสุด 10MB)'));
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const data = JSON.parse(reader.result as string);
					if (!validateDiagramImport(data)) {
						return reject(new Error('ข้อมูลเกินขีดจำกัด (entities ≤ 500, relationships ≤ 1000)'));
					}
					resolve(data);
				} catch {
					reject(new Error('Invalid JSON file'));
				}
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsText(file);
		};
		input.click();
	});
}

export async function exportPdf(svgEl: SVGSVGElement, filename: string = 'er-diagram.pdf', fontFamily: string = 'Sarabun', pageSize: 'a4' | 'letter' = 'a4', orientation: 'landscape' | 'portrait' = 'landscape') {
	const { jsPDF } = await import('jspdf');
	const fontCss = await getEmbeddedFontCss(fontFamily);
	const { clone, width, height } = prepareExportSvg(svgEl, fontCss);

	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(clone);

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const scale = 2;
	const img = new Image();
	const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(svgBlob);

	return new Promise<void>((resolve) => {
		img.onload = () => {
			canvas.width = width * scale;
			canvas.height = height * scale;
			ctx.scale(scale, scale);
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, width, height);
			ctx.drawImage(img, 0, 0, width, height);
			URL.revokeObjectURL(url);

			const pdf = new jsPDF({ orientation, format: pageSize, unit: 'pt' });
			const pdfW = pdf.internal.pageSize.getWidth();
			const pdfH = pdf.internal.pageSize.getHeight();
			const margin = 20;
			const availW = pdfW - margin * 2;
			const availH = pdfH - margin * 2;
			const ratio = Math.min(availW / width, availH / height);
			const imgW = width * ratio;
			const imgH = height * ratio;
			const x = margin + (availW - imgW) / 2;
			const y = margin + (availH - imgH) / 2;

			const imgData = canvas.toDataURL('image/png');
			pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
			pdf.save(filename);
			resolve();
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve();
		};

		img.src = url;
	});
}

// --- Enhanced PDF Export ---

export interface PdfExportOptions {
	filename?: string;
	fontFamily?: string;
	pageSize?: 'a3' | 'a4' | 'letter';
	orientation?: 'landscape' | 'portrait';
	scaleMode?: 'auto' | 'readable' | 'custom';
	minTextSizePt?: number;
	customScalePercent?: number;
	includeTitlePage?: boolean;
	diagramTitle?: string;
	diagramType?: string;
	notation?: string;
	entityCount?: number;
	relationshipCount?: number;
	attributeCount?: number;
}

type JsPDFInstance = InstanceType<(typeof import('jspdf'))['jsPDF']>;

function drawPageHeader(
	pdf: JsPDFInstance,
	title: string,
	notation: string,
	dateStr: string,
	margin: number,
	pdfW: number,
	headerY: number
) {
	pdf.setFontSize(8);
	pdf.setTextColor(100, 100, 100);
	pdf.text(title, margin, headerY);
	const rightText = `${notation}  |  ${dateStr}`;
	pdf.text(rightText, pdfW - margin, headerY, { align: 'right' });
	// Separator line
	pdf.setDrawColor(200, 200, 200);
	pdf.setLineWidth(0.5);
	pdf.line(margin, headerY + 4, pdfW - margin, headerY + 4);
}

function drawPageFooter(
	pdf: JsPDFInstance,
	pageNum: number,
	totalPages: number,
	margin: number,
	pdfW: number,
	pdfH: number,
	footerH: number
) {
	const footerY = pdfH - footerH + 10;
	// Separator line
	pdf.setDrawColor(200, 200, 200);
	pdf.setLineWidth(0.5);
	pdf.line(margin, footerY - 6, pdfW - margin, footerY - 6);
	pdf.setFontSize(7);
	pdf.setTextColor(140, 140, 140);
	pdf.text(`${pageNum} / ${totalPages}`, pdfW / 2, footerY, { align: 'center' });
}

function drawTitlePage(
	pdf: JsPDFInstance,
	options: PdfExportOptions,
	pdfW: number,
	pdfH: number
) {
	const cx = pdfW / 2;
	let y = pdfH * 0.3;

	// Title
	pdf.setFontSize(24);
	pdf.setTextColor(30, 30, 30);
	pdf.text(options.diagramTitle || 'ER Diagram', cx, y, { align: 'center' });
	y += 30;

	// Separator
	pdf.setDrawColor(180, 180, 180);
	pdf.setLineWidth(1);
	pdf.line(cx - 80, y, cx + 80, y);
	y += 30;

	// Metadata
	pdf.setFontSize(11);
	pdf.setTextColor(80, 80, 80);

	const lines: string[] = [];
	if (options.diagramType) lines.push(`Type: ${options.diagramType}`);
	if (options.notation) lines.push(`Notation: ${options.notation}`);
	if (options.entityCount !== undefined) lines.push(`Entities: ${options.entityCount}`);
	if (options.relationshipCount !== undefined) lines.push(`Relationships: ${options.relationshipCount}`);
	if (options.attributeCount !== undefined) lines.push(`Attributes: ${options.attributeCount}`);
	lines.push(`Date: ${new Date().toLocaleDateString()}`);

	for (const line of lines) {
		pdf.text(line, cx, y, { align: 'center' });
		y += 18;
	}
}

/** Page dimensions in points [shortSide, longSide] */
const PAGE_SIZES: Record<string, [number, number]> = {
	a3: [841.89, 1190.55],
	a4: [595.28, 841.89],
	letter: [612, 792]
};

/** Compute optimal ratio for readable mode — minimizes page count */
function computeReadableRatio(
	diagramW: number, diagramH: number,
	contentAreaW: number, contentAreaH: number,
	minTextSizePt: number
): number {
	const SVG_TEXT_PX = 14;
	const minRatio = (minTextSizePt * 1.333) / SVG_TEXT_PX;
	const fitRatio = Math.min(contentAreaW / diagramW, contentAreaH / diagramH);

	// Already readable at fit-to-page
	if (fitRatio >= minRatio) return fitRatio;

	// Allow 20% text reduction to minimize pages
	const softMin = minRatio * 0.8;

	const candidates: { ratio: number; pages: number }[] = [];
	const addCandidate = (r: number) => {
		if (r < softMin) return;
		const c = Math.max(1, Math.ceil((diagramW * r) / contentAreaW));
		const rw = Math.max(1, Math.ceil((diagramH * r) / contentAreaH));
		candidates.push({ ratio: r, pages: c * rw });
	};

	addCandidate(fitRatio);                  // 1 page
	addCandidate(contentAreaW / diagramW);   // fit-width → vertical pages
	addCandidate(contentAreaH / diagramH);   // fit-height → horizontal pages
	addCandidate(minRatio);                  // full requested size

	if (candidates.length === 0) return minRatio;

	// Fewest pages first, tie-break by larger ratio
	candidates.sort((a, b) => a.pages - b.pages || b.ratio - a.ratio);
	return candidates[0].ratio;
}

/** Compute ratio + page layout for given options */
function computePdfLayout(
	diagramW: number, diagramH: number,
	contentAreaW: number, contentAreaH: number,
	scaleMode: string, minTextSizePt: number, customScalePercent: number
): { ratio: number; cols: number; rows: number } {
	let ratio: number;
	if (scaleMode === 'readable') {
		ratio = computeReadableRatio(diagramW, diagramH, contentAreaW, contentAreaH, minTextSizePt);
	} else if (scaleMode === 'custom') {
		ratio = customScalePercent / 100;
	} else {
		ratio = Math.min(contentAreaW / diagramW, contentAreaH / diagramH);
	}

	let cols = Math.max(1, Math.ceil((diagramW * ratio) / contentAreaW));
	let rows = Math.max(1, Math.ceil((diagramH * ratio) / contentAreaH));

	// Snap down: if reducing 1 col/row needs ≤30% ratio reduction, do it to avoid blank pages
	const MAX_SHRINK = 0.70;
	if (cols > 1) {
		const fitted = ((cols - 1) * contentAreaW) / diagramW;
		if (fitted >= ratio * MAX_SHRINK) cols--;
	}
	if (rows > 1) {
		const fitted = ((rows - 1) * contentAreaH) / diagramH;
		if (fitted >= ratio * MAX_SHRINK) rows--;
	}

	ratio = Math.min((cols * contentAreaW) / diagramW, (rows * contentAreaH) / diagramH);
	return { ratio, cols, rows };
}

/** Estimate pages + text size + layout info */
export function estimatePdfInfo(
	svgEl: SVGSVGElement,
	options: PdfExportOptions
): { pages: number; textPt: number; cols: number; rows: number } {
	const { pageSize = 'a4', orientation = 'landscape', scaleMode = 'auto', minTextSizePt = 10, customScalePercent = 100, includeTitlePage = false } = options;

	const origGroup = svgEl.querySelector('g[transform]');
	let contentWidth = 800, contentHeight = 600;
	if (origGroup) {
		try {
			const bbox = (origGroup as SVGGraphicsElement).getBBox();
			if (bbox.width > 0 && bbox.height > 0) {
				contentWidth = bbox.width + EXPORT_PADDING * 2;
				contentHeight = bbox.height + EXPORT_PADDING * 2;
			}
		} catch { /* ignore */ }
	}

	const [shortSide, longSide] = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
	const pdfW = orientation === 'landscape' ? longSide : shortSide;
	const pdfH = orientation === 'landscape' ? shortSide : longSide;
	const margin = 20, headerH = 30, footerH = 20;
	const contentAreaW = pdfW - margin * 2;
	const contentAreaH = pdfH - margin * 2 - headerH - footerH;

	const { ratio, cols, rows } = computePdfLayout(
		contentWidth, contentHeight, contentAreaW, contentAreaH,
		scaleMode, minTextSizePt, customScalePercent
	);

	const SVG_TEXT_PX = 14;
	const textPt = Math.round((SVG_TEXT_PX * ratio) / 1.333);

	return {
		pages: cols * rows + (includeTitlePage ? 1 : 0),
		textPt,
		cols,
		rows
	};
}

/** Generate a small thumbnail data URL of the diagram for preview */
export function generateDiagramThumbnail(svgEl: SVGSVGElement): Promise<string> {
	const { clone, width, height } = prepareExportSvg(svgEl, '');
	const maxDim = 400;
	const thumbScale = Math.min(maxDim / width, maxDim / height, 1);

	return new Promise((resolve) => {
		const serializer = new XMLSerializer();
		const svgString = serializer.serializeToString(clone);

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) { resolve(''); return; }

		canvas.width = Math.ceil(width * thumbScale);
		canvas.height = Math.ceil(height * thumbScale);

		const img = new Image();
		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(svgBlob);

		img.onload = () => {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(url);
			resolve(canvas.toDataURL('image/png'));
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve('');
		};
		img.src = url;
	});
}

/** @deprecated Use estimatePdfInfo instead */
export function estimatePdfPages(
	svgEl: SVGSVGElement,
	options: PdfExportOptions
): number {
	return estimatePdfInfo(svgEl, options).pages;
}

export async function exportPdfEnhanced(
	svgEl: SVGSVGElement,
	options: PdfExportOptions = {}
) {
	const {
		filename = 'er-diagram.pdf',
		fontFamily = 'Sarabun',
		pageSize = 'a4',
		orientation = 'landscape',
		scaleMode = 'auto',
		minTextSizePt = 10,
		customScalePercent = 100,
		includeTitlePage = false
	} = options;

	const { jsPDF } = await import('jspdf');
	const fontCss = await getEmbeddedFontCss(fontFamily);
	const { clone, width, height } = prepareExportSvg(svgEl, fontCss);

	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(clone);

	// Rasterize SVG to canvas at 2x
	const rasterScale = 2;
	const fullCanvas = document.createElement('canvas');
	const fullCtx = fullCanvas.getContext('2d');
	if (!fullCtx) return;

	const img = new Image();
	const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(svgBlob);

	return new Promise<void>((resolve) => {
		img.onload = () => {
			fullCanvas.width = width * rasterScale;
			fullCanvas.height = height * rasterScale;
			fullCtx.scale(rasterScale, rasterScale);
			fullCtx.fillStyle = '#ffffff';
			fullCtx.fillRect(0, 0, width, height);
			fullCtx.drawImage(img, 0, 0, width, height);
			URL.revokeObjectURL(url);

			const pdf = new jsPDF({ orientation, format: pageSize, unit: 'pt' });
			const pdfW = pdf.internal.pageSize.getWidth();
			const pdfH = pdf.internal.pageSize.getHeight();

			const margin = 20;
			const headerH = 30;
			const footerH = 20;
			const contentAreaW = pdfW - margin * 2;
			const contentAreaH = pdfH - margin * 2 - headerH - footerH;

			const { ratio, cols, rows } = computePdfLayout(
				width, height, contentAreaW, contentAreaH,
				scaleMode, minTextSizePt, customScalePercent
			);

			const totalDiagramPages = cols * rows;
			const totalPages = totalDiagramPages + (includeTitlePage ? 1 : 0);

			const title = options.diagramTitle || 'ER Diagram';
			const notation = options.notation || '';
			const dateStr = new Date().toLocaleDateString();

			// Title page
			if (includeTitlePage) {
				drawTitlePage(pdf, options, pdfW, pdfH);
				if (totalDiagramPages > 0) pdf.addPage(pageSize, orientation);
			}

			// Distribute content evenly across tiles
			const tileSrcW = width / cols;
			const tileSrcH = height / rows;
			const tilePdfW = tileSrcW * ratio;
			const tilePdfH = tileSrcH * ratio;

			// Diagram pages
			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const pageIdx = row * cols + col;
					if (pageIdx > 0) pdf.addPage(pageSize, orientation);

					const currentPageNum = pageIdx + 1 + (includeTitlePage ? 1 : 0);
					const headerY = margin + 10;
					drawPageHeader(pdf, title, notation, dateStr, margin, pdfW, headerY);
					drawPageFooter(pdf, currentPageNum, totalPages, margin, pdfW, pdfH, footerH);

					// Extract equal tile region from full canvas
					const tileCanvas = document.createElement('canvas');
					const tileCtx = tileCanvas.getContext('2d');
					if (!tileCtx) continue;

					const srcX = col * tileSrcW;
					const srcY = row * tileSrcH;

					tileCanvas.width = Math.ceil(tileSrcW * rasterScale);
					tileCanvas.height = Math.ceil(tileSrcH * rasterScale);

					tileCtx.fillStyle = '#ffffff';
					tileCtx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);
					tileCtx.drawImage(
						fullCanvas,
						srcX * rasterScale, srcY * rasterScale,
						tileSrcW * rasterScale, tileSrcH * rasterScale,
						0, 0,
						tileCanvas.width, tileCanvas.height
					);

					// Center tile within the page content area
					const pdfX = margin + (contentAreaW - tilePdfW) / 2;
					const pdfY = margin + headerH + (contentAreaH - tilePdfH) / 2;

					const tileData = tileCanvas.toDataURL('image/png');
					pdf.addImage(tileData, 'PNG', pdfX, pdfY, tilePdfW, tilePdfH);
				}
			}

			pdf.save(filename);
			resolve();
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve();
		};

		img.src = url;
	});
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
