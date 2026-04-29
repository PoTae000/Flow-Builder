import type { NotationStyle } from '$lib/types/notation';
import type { NotationRenderer } from './types.ts';
import { CrowsFootRenderer } from './crows-foot.ts';
import { ChenRenderer } from './chen.ts';
import { UMLRenderer } from './uml.ts';
import { MinMaxRenderer } from './min-max.ts';
import { IDEF1XRenderer } from './idef1x.ts';
import { BachmanRenderer } from './bachman.ts';
import { BarkerRenderer } from './barker.ts';
import { ArrowRenderer } from './arrow.ts';

const renderers: Record<NotationStyle, NotationRenderer> = {
	'crows-foot': new CrowsFootRenderer(),
	'chen': new ChenRenderer(),
	'uml': new UMLRenderer(),
	'min-max': new MinMaxRenderer(),
	'idef1x': new IDEF1XRenderer(),
	'bachman': new BachmanRenderer(),
	'barker': new BarkerRenderer(),
	'arrow': new ArrowRenderer()
};

export function getRenderer(notation: NotationStyle): NotationRenderer {
	return renderers[notation];
}
