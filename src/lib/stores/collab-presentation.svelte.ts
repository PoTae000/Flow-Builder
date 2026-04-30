import { diagram } from './diagram.svelte';
import type { CollabState } from './collab.svelte';

/**
 * Start a presentation (this client becomes presenter).
 */
export function pushPresentationStart(collab: CollabState) {
	if (!collab._doc || !collab.connected) return;
	collab.presentationActive = true;
	collab.presentationStep = 0;
	collab.presenterId = collab.localClientId;
	collab.pushMeta('presentationActive', 'true');
	collab.pushMeta('presentationStep', '0');
	collab.pushMeta('presenterId', String(collab.localClientId));
	// Push initial view
	pushPresentationView(collab, diagram.panX, diagram.panY, diagram.zoom);
}

/**
 * Stop the current presentation.
 */
export function pushPresentationStop(collab: CollabState) {
	if (!collab._doc || !collab.connected) return;
	collab.presentationActive = false;
	collab.presentationStep = 0;
	collab.presenterId = -1;
	collab.pushMeta('presentationActive', 'false');
	collab.pushMeta('presentationStep', '0');
	collab.pushMeta('presenterId', '-1');
}

/**
 * Advance to a specific presentation step.
 */
export function pushPresentationStep(collab: CollabState, step: number) {
	if (!collab._doc || !collab.connected) return;
	const validStep = Math.max(0, Math.floor(step));
	collab.presentationStep = validStep;
	collab.pushMeta('presentationStep', String(validStep));
}

/**
 * Push the presenter's viewport (throttled by timer on collab).
 */
export function pushPresentationView(collab: CollabState, panX: number, panY: number, zoom: number) {
	if (!collab._doc || !collab.connected || !collab.presentationActive) return;
	if (collab.presenterId !== collab.localClientId) return; // only presenter
	collab.presentationPanX = panX;
	collab.presentationPanY = panY;
	collab.presentationZoom = zoom;

	// Send center-based coordinates so viewers with different screen sizes see the same content
	const screenW = diagram.canvasWidth || (typeof window !== 'undefined' ? window.innerWidth : 1920);
	const screenH = diagram.canvasHeight || (typeof window !== 'undefined' ? window.innerHeight : 1080);
	const centerX = (screenW / 2 - panX) / zoom;
	const centerY = (screenH / 2 - panY) / zoom;

	// Throttle pushes to max ~10/sec to reduce WebRTC traffic
	if (collab._presViewTimer) return;
	collab._presViewTimer = setTimeout(() => {
		collab._presViewTimer = null;
		collab.pushMeta('presentationCenterX', String(centerX));
		collab.pushMeta('presentationCenterY', String(centerY));
		collab.pushMeta('presentationZoom', String(zoom));
	}, 100);
}
