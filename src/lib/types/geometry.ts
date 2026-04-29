export interface Position {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ConnectionPoint {
	x: number;
	y: number;
	side: 'top' | 'right' | 'bottom' | 'left';
}
