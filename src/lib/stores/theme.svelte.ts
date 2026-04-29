import { DARK_COLORS, LIGHT_COLORS } from '$lib/renderers/shared/colors';
import type { ThemeColors } from '$lib/renderers/shared/colors';

class ThemeState {
	mode = $state<'dark' | 'light'>('light');
	colors: ThemeColors = $derived(this.mode === 'dark' ? DARK_COLORS : LIGHT_COLORS);

	toggle() {
		this.mode = this.mode === 'dark' ? 'light' : 'dark';
	}

	get isDark() {
		return this.mode === 'dark';
	}
}

export const theme = new ThemeState();
