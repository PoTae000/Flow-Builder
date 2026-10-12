import { DARK_COLORS, LIGHT_COLORS } from '$lib/renderers/shared/colors';
import type { ThemeColors } from '$lib/renderers/shared/colors';

const STORAGE_KEY = 'flow-builder-theme';

function readInitial(): 'dark' | 'light' {
	if (typeof localStorage === 'undefined') return 'light';
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === 'dark' || saved === 'light') return saved;

	if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}
	return 'light';
}


function applyToDom(mode: 'dark' | 'light') {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', mode === 'dark');
}

class ThemeState {
	erPreset = $state('standard');
	get erColorful() { return this.erPreset !== 'standard'; }
	setERPreset(value: string) {
		if (!['standard', 'pastel', 'ocean', 'sunset', 'forest', 'mono'].includes(value)) return;
		this.erPreset = value;
		if (typeof localStorage !== 'undefined') localStorage.setItem('flow-builder-er-preset', value);
	}
	erAccent(id: string) {
		const palettes: Record<string, string[]> = {
			pastel: ['#93c5fd', '#c4b5fd', '#5eead4', '#fdba74', '#f9a8d4'],
			ocean: ['#38bdf8', '#22d3ee', '#60a5fa', '#818cf8'],
			sunset: ['#fb923c', '#fb7185', '#f472b6', '#fbbf24'],
			forest: ['#34d399', '#2dd4bf', '#a3e635', '#4ade80'],
			mono: [this.isDark ? '#94a3b8' : '#64748b']
		};
		const palette = palettes[this.erPreset] || palettes.pastel;
		let hash = 0;
		for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
		return palette[hash % palette.length];
	}
	mode = $state<'dark' | 'light'>(readInitial());
	colors: ThemeColors = $derived(this.mode === 'dark' ? DARK_COLORS : LIGHT_COLORS);

	constructor() {
		if (typeof localStorage !== 'undefined') this.setERPreset(localStorage.getItem('flow-builder-er-preset') || 'standard');
		applyToDom(this.mode);
	}

	private persist() {
		if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, this.mode);
		applyToDom(this.mode);
	}

	set(mode: 'dark' | 'light') {
		this.mode = mode;
		this.persist();
	}

	toggle() {
		this.mode = this.mode === 'dark' ? 'light' : 'dark';
		this.persist();
	}

	get isDark() {
		return this.mode === 'dark';
	}
}

export const theme = new ThemeState();
