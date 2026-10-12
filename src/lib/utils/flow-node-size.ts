
import type { FlowNode, FlowNodeType } from '$lib/types/flowchart';

const DEFAULT_W = 140;
const DEFAULT_H = 60;


let measureCanvas: HTMLCanvasElement | null = null;


export function measureFlowText(text: string, fontSize: number, fontWeight: number, italic: boolean): number {
	return measureWidth(text, fontSize, fontWeight, italic);
}

function measureWidth(text: string, fontSize: number, fontWeight: number, italic: boolean): number {
	if (typeof document === 'undefined') return text.length * fontSize * 0.58;
	measureCanvas ??= document.createElement('canvas');
	const ctx = measureCanvas.getContext('2d');
	if (!ctx) return text.length * fontSize * 0.58;
	ctx.font = `${italic ? 'italic ' : ''}${fontWeight} ${fontSize}px system-ui, -apple-system, sans-serif`;
	return ctx.measureText(text).width;
}


function wrapLine(
	text: string,
	maxW: number,
	fontSize: number,
	fontWeight: number,
	italic: boolean
): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [''];
	const out: string[] = [];
	let cur = '';
	for (const w of words) {
		const trial = cur ? `${cur} ${w}` : w;
		if (cur && measureWidth(trial, fontSize, fontWeight, italic) > maxW) {
			out.push(cur);
			cur = w;
		} else {
			cur = trial;
		}
	}
	if (cur) out.push(cur);
	return out;
}


function shapeFactors(type: FlowNodeType): {
	widthRatio: number;
	padX: number;
	padY: number;
	square: boolean;
} {
	switch (type) {
		case 'decision':
			return { widthRatio: 0.6, padX: 48, padY: 40, square: false };
		case 'connector':
		case 'circle':
		case 'or':
		case 'summing-junction':
			return { widthRatio: 0.72, padX: 24, padY: 24, square: true };
		case 'preparation':
		case 'trapezoid':
		case 'merge':
		case 'extract':
		case 'triangle':
		case 'manual-operation':
			return { widthRatio: 0.62, padX: 52, padY: 28, square: false };
		case 'step':
		case 'card':
		case 'off-page-connector':
			return { widthRatio: 0.74, padX: 44, padY: 24, square: false };
		case 'input-output':
		case 'display':
			return { widthRatio: 0.82, padX: 40, padY: 24, square: false };
		default:

			return { widthRatio: 1, padX: 32, padY: 26, square: false };
	}
}


export function wrapFlowNodeLabel(node: FlowNode, baseFontSize = 14): string[] {
	const fontSize = flowNodeFontSize(node, baseFontSize);
	const fontWeight = flowNodeFontWeight(node);
	const italic = node.italic ?? false;
	const { widthRatio, padX } = shapeFactors(node.type);


	const boxW = node.width ?? DEFAULT_W;
	const usable = Math.max(boxW * widthRatio - padX, 40);
	const rawLines = (node.name ?? '').split('\n');
	return rawLines.flatMap((l) => wrapLine(l, usable, fontSize, fontWeight, italic));
}

export interface FlowNodeSize {
	width: number;
	height: number;
}


export function computeFlowNodeSize(node: FlowNode, baseFontSize = 14): FlowNodeSize {
	if (node.type === 'connector') return { width: node.width ?? 28, height: node.height ?? 28 };
	const fontSize = flowNodeFontSize(node, baseFontSize);
	const fontWeight = flowNodeFontWeight(node);
	const italic = node.italic ?? false;
	const lineHeight = Math.round(fontSize * 1.25);
	const { widthRatio, padX, padY, square } = shapeFactors(node.type);




	const baseUsable = DEFAULT_W * widthRatio - padX;
	const targetUsable = Math.max(baseUsable, 60);

	const rawLines = (node.name ?? '').split('\n');
	const lines = rawLines.flatMap((l) => wrapLine(l, targetUsable, fontSize, fontWeight, italic));


	let maxLineW = 0;
	for (const l of lines) {
		const w = measureWidth(l || ' ', fontSize, fontWeight, italic);
		if (w > maxLineW) maxLineW = w;
	}

	const textBlockW = Math.max(maxLineW, targetUsable * 0.4);
	const textBlockH = lines.length * lineHeight;

	let width = Math.ceil(textBlockW / widthRatio + padX);
	let height = Math.ceil(textBlockH + padY);


	width = Math.max(width, DEFAULT_W);
	height = Math.max(height, DEFAULT_H);

	if (square) {
		const d = Math.max(width, height);
		width = d;
		height = d;
	}

	return { width, height };
}


export function autoSizeFlowNode(node: FlowNode, baseFontSize = 14): boolean {
	if (node.manualSize) return false;

	if (node.type === 'connector') {
		const changed = node.width === undefined || node.height === undefined;
		node.width ??= 28;
		node.height ??= 28;
		return changed;
	}
	const { width, height } = computeFlowNodeSize(node, baseFontSize);
	if (node.width === width && node.height === height) return false;
	node.width = width;
	node.height = height;
	return true;
}

export function flowNodeFontSize(node: FlowNode, baseFontSize = 14): number {
	return node.fontSize ?? Math.max(8, Math.round(baseFontSize * 0.86));
}

export function flowNodeFontWeight(node: FlowNode): number {
	return node.bold === undefined ? 500 : node.bold ? 600 : 400;
}
