import { diagram } from '$lib/stores/diagram.svelte';
import { collab } from '$lib/stores/collab.svelte';
import type { Position } from '$lib/types/geometry';

export type ERShape = 'entity' | 'weak-entity';
export function placeERShape(type: string, position?: Position) {
	if (diagram.diagramType !== 'er' || diagram.viewOnly || collab.isViewer) return;
	if (type === 'entity' || type === 'weak-entity') {
		const base = type === 'entity' ? 'Entity' : 'WeakEntity';
		let number = 1;
		while (diagram.entities.some((e) => e.name === `${base}${number}`)) number++;
		const entity = diagram.addEntity(`${base}${number}`, position);
		if (type === 'weak-entity') diagram.updateEntity(entity.id, { isWeak: true });
		return;
	}
}
