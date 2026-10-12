


let _ctx: CanvasRenderingContext2D | null = null;

function ctx(): CanvasRenderingContext2D | null {
	if (_ctx) return _ctx;
	if (typeof document === 'undefined') return null;
	const c = document.createElement('canvas');
	_ctx = c.getContext('2d');
	return _ctx;
}

export interface NodeTextMetrics {
	
	textWidth: number;
	
	lineCount: number;
	
	lineHeight: number;
}


export function measureNodeText(
	text: string,
	fontSize: number,
	fontFamily: string,
	bold: boolean
): NodeTextMetrics {
	const lines = (text ?? '').split('\n');
	const lineHeight = Math.round(fontSize * 1.25);
	const c = ctx();
	if (!c) {
		
		const widest = lines.reduce((m, l) => Math.max(m, l.length), 0);
		return { textWidth: widest * fontSize * 0.6, lineCount: lines.length, lineHeight };
	}
	c.font = `${bold ? '600' : '400'} ${fontSize}px ${fontFamily}`;
	let textWidth = 0;
	for (const line of lines) {
		textWidth = Math.max(textWidth, c.measureText(line || ' ').width);
	}
	return { textWidth, lineCount: lines.length, lineHeight };
}


export function nodeSizeForText(
	text: string,
	fontSize: number,
	fontFamily: string,
	bold: boolean,
	opts: { minW?: number; minH?: number; padX?: number; padY?: number } = {}
): { width: number; height: number } {
	const { minW = 80, minH = 44, padX = 28, padY = 20 } = opts;
	const m = measureNodeText(text, fontSize, fontFamily, bold);
	const width = Math.max(minW, Math.ceil(m.textWidth + padX));
	const height = Math.max(minH, Math.ceil(m.lineCount * m.lineHeight + padY));
	return { width, height };
}
