import { quintOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

export function dockPanel(node: Element): TransitionConfig {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return { duration: 0 };
	const bottom = window.matchMedia('(max-width: 1023px)').matches;
	const rect = node.getBoundingClientRect();
	const distance = bottom ? rect.height : rect.width;
	return {
		duration: 320,
		easing: quintOut,
		css: (t) => `transform: translate3d(${bottom ? 0 : (1 - t) * distance}px, ${bottom ? (1 - t) * distance : 0}px, 0); opacity: ${0.7 + 0.3 * t};`
	};
}
