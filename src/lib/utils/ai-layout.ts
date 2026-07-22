import type { Entity, Relationship } from '$lib/types/er';
import type { Position } from '$lib/types/geometry';
import { aiFetch } from '$lib/utils/ai-fetch';

/**
 * Compute layout positions using AI (Groq LLM).
 * Returns a Map of entity ID → position, or null if AI is unavailable or fails.
 */
export async function computeAILayout(
	entities: Entity[],
	relationships: Relationship[],
	notation: string,
	estimateBox: (e: Entity) => { w: number; h: number }
): Promise<Map<string, Position> | null> {
	if (entities.length === 0) return null;

	// Abort controller with 10s timeout — if AI is too slow, fall back to ELK
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10000);

	// Check if AI is available
	try {
		const checkRes = await fetch('/api/import/check', { signal: controller.signal });
		if (!checkRes.ok) { clearTimeout(timeout); return null; }
		const checkData = await checkRes.json();
		if (!checkData.available) { clearTimeout(timeout); return null; }
	} catch {
		clearTimeout(timeout);
		return null;
	}

	// Call the layout endpoint
	try {
		const body = {
			entities: entities.map((e) => ({
				id: e.id,
				name: e.name,
				attributes: e.attributes.map((a) => ({ name: a.name, type: a.type })),
				isWeak: e.isWeak
			})),
			relationships: relationships.map((r) => ({
				name: r.name,
				entityIds: r.entityIds,
				cardinalities: r.cardinalities,
				isIdentifying: r.isIdentifying
			})),
			notation
		};

		const res = await aiFetch('/api/layout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		});

		clearTimeout(timeout);
		if (!res.ok) return null;

		const data = await res.json();
		if (!data.result) return null;

		// Parse the AI response — expect { positions: { [id]: {x, y} } }
		let parsed: { positions: Record<string, { x: number; y: number }> };
		if (typeof data.result === 'string') {
			// Strip markdown code fences if present
			const cleaned = data.result.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
			parsed = JSON.parse(cleaned);
		} else {
			parsed = data.result;
		}

		if (!parsed.positions || typeof parsed.positions !== 'object') return null;

		// Convert to Map
		const positions = new Map<string, Position>();
		for (const [id, pos] of Object.entries(parsed.positions)) {
			if (typeof pos.x === 'number' && typeof pos.y === 'number') {
				positions.set(id, { x: Math.round(pos.x), y: Math.round(pos.y) });
			}
		}

		// Verify all entities have positions
		if (positions.size < entities.length * 0.7) return null;

		// Fill in missing positions (if AI missed some)
		let maxY = 0;
		for (const pos of positions.values()) {
			maxY = Math.max(maxY, pos.y);
		}
		for (const e of entities) {
			if (!positions.has(e.id)) {
				maxY += 200;
				positions.set(e.id, { x: 60, y: maxY });
			}
		}

		// Post-processing: resolve overlaps
		resolveOverlaps(entities, positions, estimateBox, notation);

		// Normalize to start at (60, 60)
		let minX = Infinity;
		let minY = Infinity;
		for (const pos of positions.values()) {
			minX = Math.min(minX, pos.x);
			minY = Math.min(minY, pos.y);
		}
		for (const [id, pos] of positions) {
			positions.set(id, {
				x: Math.round(pos.x - minX + 60),
				y: Math.round(pos.y - minY + 60)
			});
		}

		return positions;
	} catch {
		clearTimeout(timeout);
		return null;
	}
}

/**
 * Post-processing: push overlapping entities apart.
 * AI may place entities with sub-pixel accuracy issues.
 */
function resolveOverlaps(
	entities: Entity[],
	positions: Map<string, Position>,
	estimateBox: (e: Entity) => { w: number; h: number },
	notation: string
): void {
	const isChen = notation === 'chen';
	const PAD = isChen ? 50 : 30;
	const ids = entities.map((e) => e.id);

	// Compute sizes with Chen oval space
	const sizes = new Map<string, { w: number; h: number }>();
	for (const e of entities) {
		const box = estimateBox(e);
		if (isChen && e.attributes.length > 0) {
			sizes.set(e.id, { w: box.w + 120, h: box.h + 120 });
		} else {
			sizes.set(e.id, box);
		}
	}

	for (let pass = 0; pass < 40; pass++) {
		let moved = false;
		for (let i = 0; i < ids.length; i++) {
			for (let j = i + 1; j < ids.length; j++) {
				const pA = positions.get(ids[i])!;
				const pB = positions.get(ids[j])!;
				const sA = sizes.get(ids[i])!;
				const sB = sizes.get(ids[j])!;

				const lA = pA.x - PAD;
				const rA = pA.x + sA.w + PAD;
				const tA = pA.y - PAD;
				const bA = pA.y + sA.h + PAD;
				const lB = pB.x - PAD;
				const rB = pB.x + sB.w + PAD;
				const tB = pB.y - PAD;
				const bB = pB.y + sB.h + PAD;

				if (rA > lB && lA < rB && bA > tB && tA < bB) {
					moved = true;
					const ox = Math.min(rA - lB, rB - lA);
					const oy = Math.min(bA - tB, bB - tA);
					const cxA = pA.x + sA.w / 2;
					const cxB = pB.x + sB.w / 2;
					const cyA = pA.y + sA.h / 2;
					const cyB = pB.y + sB.h / 2;

					if (ox < oy) {
						const push = ox / 2 + 5;
						if (cxA <= cxB) { pA.x -= push; pB.x += push; }
						else { pA.x += push; pB.x -= push; }
					} else {
						const push = oy / 2 + 5;
						if (cyA <= cyB) { pA.y -= push; pB.y += push; }
						else { pA.y += push; pB.y -= push; }
					}
				}
			}
		}
		if (!moved) break;
	}
}
