import type { Entity, Attribute, Relationship, CardinalityType, Note, NoteColor } from '$lib/types/er';
import type { NotationStyle } from '$lib/types/notation';
import type { Position } from '$lib/types/geometry';
import type { DiagramType } from '$lib/types/diagram';
import type { FlowNode, FlowNodeType, FlowEdge } from '$lib/types/flowchart';
import type { DFDNode, DFDNodeType, DFDFlow } from '$lib/types/context-diagram';
import { generateId } from '$lib/utils/id';

// Lazy import to avoid circular dependency — collab imports diagram
let _collab: typeof import('./collab.svelte')['collab'] | null = null;
function getCollab() {
	if (!_collab) {
		try {
			// Dynamic require won't work in ESM; we set this from collab.svelte.ts instead
		} catch { /* noop */ }
	}
	return _collab;
}
/** Called by collab.svelte.ts to register itself */
export function registerCollab(c: typeof _collab) {
	_collab = c;
}

export class DiagramState {
	// Diagram type
	diagramType = $state<DiagramType>('er');

	// ER data
	entities = $state<Entity[]>([]);
	relationships = $state<Relationship[]>([]);
	notes = $state<Note[]>([]);
	notation = $state<NotationStyle>('crows-foot');

	// Flowchart data
	flowNodes = $state<FlowNode[]>([]);
	flowEdges = $state<FlowEdge[]>([]);

	// Context diagram (DFD) data
	dfdNodes = $state<DFDNode[]>([]);
	dfdFlows = $state<DFDFlow[]>([]);

	// Selection (generic)
	selectedNodeIds = $state<string[]>([]);
	selectedEdgeId = $state<string | null>(null);

	// O(1) lookup Set derived from selectedNodeIds — use in hot render paths
	selectedNodeIdSet = $derived(new Set(this.selectedNodeIds));

	// Derived: single selected node ID (for form panel compat)
	selectedEntityId = $derived(
		this.selectedNodeIds.length === 1 ? this.selectedNodeIds[0] : null
	);

	// Diagram font
	diagramFont = $state("'TH Sarabun PSK', 'Sarabun', sans-serif");

	// Pan & zoom
	panX = $state(0);
	panY = $state(0);
	zoom = $state(1);

	// View bookmarks (1-9 keyboard shortcuts)
	bookmarks = $state<Map<number, { panX: number; panY: number; zoom: number }>>(new Map());

	// Actual canvas dimensions (updated by DiagramCanvas on mount/resize)
	canvasWidth = $state(0);
	canvasHeight = $state(0);

	// Undo/Redo history
	private history: string[] = [];
	private historyLabels: string[] = [];
	private future: string[] = [];
	private futureLabels: string[] = [];
	private get maxHistory(): number {
		// Scale undo history depth based on diagram size to limit memory usage
		// Large diagrams (~500 entities) produce ~500KB snapshots, so fewer steps
		const totalItems = this.entities.length + this.flowNodes.length + this.dfdNodes.length;
		if (totalItems > 200) return 8;
		if (totalItems > 100) return 12;
		return 20;
	}

	// Clipboard for copy/paste
	private clipboard: string | null = null;

	// Grid: show grid lines + snap
	showGrid = $state(false);

	// View-only mode (shared link)
	viewOnly = $state(false);

	// Animation: pop-in / pop-out for entities & nodes
	newEntityIds = $state<Set<string>>(new Set());
	dyingEntities = $state<Array<Entity & { _dyingRect?: { x: number; y: number; width: number; height: number } }>>([]);

	// Animation: relationship line draw
	newRelationshipIds = $state<Set<string>>(new Set());

	// Focus mode
	focusMode = $state(false);

	focusedEntityIds = $derived.by(() => {
		if (!this.focusMode || this.selectedNodeIds.length === 0) return null;
		const set = new Set<string>(this.selectedNodeIds);
		for (const rel of this.relationships) {
			if (rel.entityIds.some((eid) => set.has(eid))) {
				set.add(rel.entityIds[0]);
				set.add(rel.entityIds[1]);
			}
		}
		return set;
	});

	focusedRelIds = $derived.by(() => {
		if (!this.focusedEntityIds) return null;
		const set = new Set<string>();
		for (const rel of this.relationships) {
			if (this.focusedEntityIds.has(rel.entityIds[0]) && this.focusedEntityIds.has(rel.entityIds[1])) {
				set.add(rel.id);
			}
		}
		return set;
	});

	// Smooth CSS transition flag for pan/zoom
	smoothTransition = $state(false);

	// Public history access
	get canUndo() { return this.history.length > 0; }
	get canRedo() { return this.future.length > 0; }
	get historyEntries() { return this.historyLabels; }

	// Derived
	entityMap = $derived(
		new Map(this.entities.map((e) => [e.id, e]))
	);

	selectedEntity = $derived(
		this.selectedEntityId ? this.entityMap.get(this.selectedEntityId) ?? null : null
	);

	selectedRelationship = $derived(
		this.selectedEdgeId
			? this.relationships.find((r) => r.id === this.selectedEdgeId) ?? null
			: null
	);

	// History helpers
	private snapshot(): string {
		return JSON.stringify({
			entities: this.entities,
			relationships: this.relationships,
			notes: this.notes,
			flowNodes: this.flowNodes,
			flowEdges: this.flowEdges,
			dfdNodes: this.dfdNodes,
			dfdFlows: this.dfdFlows
		});
	}

	private restore(json: string) {
		const data = JSON.parse(json);
		this.entities = data.entities;
		this.relationships = data.relationships;
		this.notes = data.notes ?? [];
		this.flowNodes = data.flowNodes ?? [];
		this.flowEdges = data.flowEdges ?? [];
		this.dfdNodes = data.dfdNodes ?? [];
		this.dfdFlows = data.dfdFlows ?? [];
		this.clearSelection();
	}

	pushHistory(label?: string) {
		this.history.push(this.snapshot());
		this.historyLabels.push(label ?? this.autoLabel());
		if (this.history.length > this.maxHistory) {
			this.history.shift();
			this.historyLabels.shift();
		}
		this.future = [];
		this.futureLabels = [];
	}

	private autoLabel(): string {
		return 'Edit';
	}

	undo() {
		// Collab mode: use Y.js UndoManager (only undoes this client's changes)
		const c = getCollab();
		if (c?.connected && c.collabUndo()) return;

		// Solo mode: use local JSON snapshot history
		if (this.history.length === 0) return;
		this.future.push(this.snapshot());
		this.futureLabels.push(this.historyLabels.pop() ?? 'Undo');
		this.restore(this.history.pop()!);
	}

	redo() {
		// Collab mode: use Y.js UndoManager
		const c = getCollab();
		if (c?.connected && c.collabRedo()) return;

		// Solo mode: use local JSON snapshot history
		if (this.future.length === 0) return;
		this.history.push(this.snapshot());
		this.historyLabels.push(this.futureLabels.pop() ?? 'Redo');
		this.restore(this.future.pop()!);
	}

	// Entity CRUD
	addEntity(name: string, position?: Position): Entity {
		this.pushHistory();
		const entity: Entity = {
			id: generateId(),
			name,
			attributes: [],
			position: position ?? this.getNextPosition(),
			isWeak: false
		};
		this.entities.push(entity);
		this.selectedNodeIds = [entity.id];
		// Trigger pop-in animation
		this.newEntityIds = new Set([...this.newEntityIds, entity.id]);
		setTimeout(() => {
			this.newEntityIds = new Set([...this.newEntityIds].filter(id => id !== entity.id));
		}, 600);
		getCollab()?.pushEntityChange(entity);
		return entity;
	}

	updateEntity(id: string, updates: Partial<Pick<Entity, 'name' | 'isWeak' | 'color' | 'isLocked'>>) {
		const entity = this.entities.find((e) => e.id === id);
		if (!entity) return;
		this.pushHistory();
		if (updates.name !== undefined) entity.name = updates.name;
		if (updates.isWeak !== undefined) entity.isWeak = updates.isWeak;
		if (updates.color !== undefined) entity.color = updates.color;
		if (updates.isLocked !== undefined) entity.isLocked = updates.isLocked;
		getCollab()?.pushEntityChange(entity);
	}

	removeEntity(id: string) {
		this.pushHistory();
		// Trigger dying animation
		const dying = this.entities.find((e) => e.id === id);
		if (dying) {
			const box = this.estimateEntityBox(dying);
			this.dyingEntities = [...this.dyingEntities, { ...dying, _dyingRect: { x: dying.position.x, y: dying.position.y, width: box.w, height: box.h } }];
			setTimeout(() => { this.dyingEntities = this.dyingEntities.filter((e) => e.id !== id); }, 300);
		}
		const removedRels = this.relationships.filter((r) => r.entityIds.includes(id));
		this.relationships = this.relationships.filter(
			(r) => !r.entityIds.includes(id)
		);
		this.entities = this.entities.filter((e) => e.id !== id);
		this.selectedNodeIds = this.selectedNodeIds.filter((eid) => eid !== id);
		const c = getCollab();
		if (c) {
			c.pushEntityRemove(id);
			for (const rel of removedRels) c.pushRelationshipRemove(rel.id);
		}
	}

	removeEntities(ids: string[]) {
		if (ids.length === 0) return;
		this.pushHistory();
		const idSet = new Set(ids);
		// Trigger dying animation
		const dyingEnts = this.entities.filter((e) => idSet.has(e.id)).map((e) => {
			const box = this.estimateEntityBox(e);
			return { ...e, _dyingRect: { x: e.position.x, y: e.position.y, width: box.w, height: box.h } };
		});
		if (dyingEnts.length > 0) {
			this.dyingEntities = [...this.dyingEntities, ...dyingEnts];
			const dyingIds = new Set(dyingEnts.map((e) => e.id));
			setTimeout(() => { this.dyingEntities = this.dyingEntities.filter((e) => !dyingIds.has(e.id)); }, 300);
		}
		const removedRels = this.relationships.filter(
			(r) => r.entityIds.some((eid) => idSet.has(eid))
		);
		this.relationships = this.relationships.filter(
			(r) => !r.entityIds.some((eid) => idSet.has(eid))
		);
		this.entities = this.entities.filter((e) => !idSet.has(e.id));
		this.selectedNodeIds = [];
		const c = getCollab();
		if (c) {
			for (const id of ids) c.pushEntityRemove(id);
			for (const rel of removedRels) c.pushRelationshipRemove(rel.id);
		}
	}

	toggleLockEntity(id: string) {
		const entity = this.entities.find((e) => e.id === id);
		if (!entity) return;
		this.pushHistory();
		entity.isLocked = !entity.isLocked;
		getCollab()?.pushEntityChange(entity);
	}

	moveEntity(id: string, position: Position) {
		this.cancelAnimation();
		const entity = this.entities.find((e) => e.id === id);
		if (entity?.isLocked) return;
		if (entity) {
			if (this.showGrid) {
				position = {
					x: Math.round(position.x / 20) * 20,
					y: Math.round(position.y / 20) * 20
				};
			}

			// Chen notation: offset attribute positions when entity moves
			if (this.notation === 'chen' && entity.attributes.some(a => a.position)) {
				const dx = position.x - entity.position.x;
				const dy = position.y - entity.position.y;
				for (const attr of entity.attributes) {
					if (attr.position) {
						attr.position = {
							x: attr.position.x + dx,
							y: attr.position.y + dy
						};
					}
				}
			}

			entity.position = position;
			getCollab()?.pushEntityChange(entity);
		}
	}

	// Attribute CRUD
	addAttribute(entityId: string, attr: Omit<Attribute, 'id'>): Attribute | null {
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return null;
		this.pushHistory();
		const attribute: Attribute = { id: generateId(), ...attr };
		entity.attributes.push(attribute);
		getCollab()?.pushEntityChange(entity);
		return attribute;
	}

	updateAttribute(entityId: string, attrId: string, updates: Partial<Omit<Attribute, 'id'>>) {
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		const attr = entity.attributes.find((a) => a.id === attrId);
		if (!attr) return;
		this.pushHistory();
		Object.assign(attr, updates);
		getCollab()?.pushEntityChange(entity);
	}

	removeAttribute(entityId: string, attrId: string) {
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		this.pushHistory();
		entity.attributes = entity.attributes.filter((a) => a.id !== attrId);
		getCollab()?.pushEntityChange(entity);
	}

	/** Move Chen attribute oval to a custom position (drag) */
	moveAttributePosition(entityId: string, attrId: string, position: Position) {
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		const attr = entity.attributes.find((a) => a.id === attrId);
		if (attr) {
			attr.position = position;
			getCollab()?.pushEntityChange(entity);
		}
	}

	moveAttribute(entityId: string, attrId: string, direction: -1 | 1) {
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		const idx = entity.attributes.findIndex((a) => a.id === attrId);
		const newIdx = idx + direction;
		if (idx < 0 || newIdx < 0 || newIdx >= entity.attributes.length) return;
		this.pushHistory();
		const attrs = [...entity.attributes];
		[attrs[idx], attrs[newIdx]] = [attrs[newIdx], attrs[idx]];
		entity.attributes = attrs;
		getCollab()?.pushEntityChange(entity);
	}

	reorderAttribute(entityId: string, fromAttrId: string, toAttrId: string) {
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		const fromIdx = entity.attributes.findIndex((a) => a.id === fromAttrId);
		const toIdx = entity.attributes.findIndex((a) => a.id === toAttrId);
		if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
		this.pushHistory();
		const attrs = [...entity.attributes];
		const [moved] = attrs.splice(fromIdx, 1);
		attrs.splice(toIdx, 0, moved);
		entity.attributes = attrs;
		getCollab()?.pushEntityChange(entity);
	}

	// Relationship CRUD
	addRelationship(
		name: string,
		entityIds: [string, string],
		cardinalities: [CardinalityType, CardinalityType]
	): Relationship | null {
		if (!this.entityMap.has(entityIds[0]) || !this.entityMap.has(entityIds[1])) return null;
		if (entityIds[0] === entityIds[1]) return null;
		const exists = this.relationships.some(r =>
			(r.entityIds[0] === entityIds[0] && r.entityIds[1] === entityIds[1]) ||
			(r.entityIds[0] === entityIds[1] && r.entityIds[1] === entityIds[0])
		);
		if (exists) return null;
		this.pushHistory();
		const rel: Relationship = {
			id: generateId(),
			name,
			entityIds,
			cardinalities,
			isIdentifying: false
		};
		this.relationships.push(rel);
		this.selectedEdgeId = rel.id;
		// Trigger line draw animation
		this.newRelationshipIds = new Set([...this.newRelationshipIds, rel.id]);
		setTimeout(() => {
			this.newRelationshipIds = new Set([...this.newRelationshipIds].filter(id => id !== rel.id));
		}, 800);
		getCollab()?.pushRelationshipChange(rel);
		return rel;
	}

	updateRelationship(id: string, updates: Partial<Pick<Relationship, 'name' | 'cardinalities' | 'isIdentifying' | 'description'>>) {
		const rel = this.relationships.find((r) => r.id === id);
		if (!rel) return;
		this.pushHistory();
		if (updates.name !== undefined) rel.name = updates.name;
		if (updates.cardinalities !== undefined) rel.cardinalities = updates.cardinalities;
		if (updates.isIdentifying !== undefined) rel.isIdentifying = updates.isIdentifying;
		if (updates.description !== undefined) rel.description = updates.description;
		getCollab()?.pushRelationshipChange(rel);
	}

	removeRelationship(id: string) {
		this.pushHistory();
		this.relationships = this.relationships.filter((r) => r.id !== id);
		if (this.selectedEdgeId === id) this.selectedEdgeId = null;
		getCollab()?.pushRelationshipRemove(id);
	}

	// Diagram font
	setDiagramFont(font: string) {
		this.diagramFont = font;
		getCollab()?.pushMeta('diagramFont', font);
	}

	// Notation
	setNotation(notation: NotationStyle) {
		this.notation = notation;
		getCollab()?.pushMeta('notation', notation);
	}

	// Pan & Zoom
	setPan(x: number, y: number) {
		this.panX = x;
		this.panY = y;
	}

	setZoom(zoom: number) {
		this.zoom = Math.max(0.25, Math.min(3, zoom));
	}

	resetView() {
		this.panX = 0;
		this.panY = 0;
		this.zoom = 1;
	}

	smoothResetView() {
		this.smoothTransition = true;
		this.resetView();
		setTimeout(() => { this.smoothTransition = false; }, 300);
	}

	smoothFitToContent(containerW: number, containerH: number) {
		this.smoothTransition = true;
		this.fitToContent(containerW, containerH);
		setTimeout(() => { this.smoothTransition = false; }, 300);
	}

	/**
	 * Save current view to a bookmark slot (1-9)
	 */
	saveBookmark(slot: number) {
		if (slot < 1 || slot > 9) return;
		this.bookmarks.set(slot, {
			panX: this.panX,
			panY: this.panY,
			zoom: this.zoom
		});
	}

	/**
	 * Load view from a bookmark slot (1-9)
	 * Returns true if bookmark exists, false otherwise
	 */
	loadBookmark(slot: number): boolean {
		if (slot < 1 || slot > 9) return false;
		const bookmark = this.bookmarks.get(slot);
		if (!bookmark) return false;

		this.smoothTransition = true;
		this.panX = bookmark.panX;
		this.panY = bookmark.panY;
		this.zoom = bookmark.zoom;
		setTimeout(() => {
			this.smoothTransition = false;
		}, 300);

		return true;
	}

	/** Adjust pan & zoom so all content fits within the given container size. */
	fitToContent(containerW: number, containerH: number) {
		const PADDING = 60;
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		const expand = (x: number, y: number, w: number, h: number) => {
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x + w > maxX) maxX = x + w;
			if (y + h > maxY) maxY = y + h;
		};

		if (this.diagramType === 'er') {
			for (const e of this.entities) {
				const box = this.estimateEntityBox(e);
				expand(e.position.x, e.position.y, box.w, box.h);
				// Chen ovals extend beyond the entity box
				if (this.notation === 'chen' && e.attributes.length > 0) {
					expand(e.position.x - 100, e.position.y - 100, box.w + 200, box.h + 200);
				}
			}
			for (const n of this.notes) {
				expand(n.position.x, n.position.y, 200, 60);
			}
		} else if (this.diagramType === 'flowchart') {
			for (const node of this.flowNodes) {
				const { x: cx, y: cy } = node.position;
				if (node.type === 'connector') {
					expand(cx - 25, cy - 25, 50, 50);
				} else {
					expand(cx - 70, cy - 30, 140, 60);
				}
			}
		} else if (this.diagramType === 'context') {
			for (const node of this.dfdNodes) {
				const { x: cx, y: cy } = node.position;
				if (node.type === 'external-entity') {
					expand(cx - 40, cy - 40, 80, 80);
				} else if (node.type === 'data-store') {
					expand(cx - 70, cy - 20, 140, 40);
				} else {
					expand(cx - 60, cy - 25, 120, 50);
				}
			}
		}

		// No content — reset to default
		if (minX === Infinity) {
			this.resetView();
			return;
		}

		const contentW = maxX - minX + PADDING * 2;
		const contentH = maxY - minY + PADDING * 2;
		const newZoom = Math.max(0.1, Math.min(3, Math.min(containerW / contentW, containerH / contentH)));
		const newPanX = (containerW - contentW * newZoom) / 2 - (minX - PADDING) * newZoom;
		const newPanY = (containerH - contentH * newZoom) / 2 - (minY - PADDING) * newZoom;

		this.zoom = newZoom;
		this.panX = newPanX;
		this.panY = newPanY;
	}

	/** Center viewport on a specific rectangle in diagram space with comfortable zoom. */
	centerOnRect(rx: number, ry: number, rw: number, rh: number, containerW: number, containerH: number) {
		const PADDING = 120;
		const contentW = rw + PADDING * 2;
		const contentH = rh + PADDING * 2;
		const newZoom = Math.max(0.1, Math.min(2, Math.min(containerW / contentW, containerH / contentH)));
		const centerX = rx + rw / 2;
		const centerY = ry + rh / 2;
		this.zoom = newZoom;
		this.panX = containerW / 2 - centerX * newZoom;
		this.panY = containerH / 2 - centerY * newZoom;
	}

	// Auto layout helper
	private getNextPosition(): Position {
		const cols = 3;
		const spacingX = 280;
		const spacingY = 250;
		const startX = 60;
		const startY = 60;
		const index = this.entities.length;
		return {
			x: startX + (index % cols) * spacingX,
			y: startY + Math.floor(index / cols) * spacingY
		};
	}

	// Estimate entity box size for layout (actual rendered box size)
	estimateEntityBox(entity: Entity): { w: number; h: number } {
		if (this.notation === 'chen') {
			const charWidth = 9;
			const nameWidth = entity.name.length * charWidth + 32;
			return { w: Math.max(120, nameWidth), h: 48 };
		}
		const charWidth = 8;
		const nameWidth = entity.name.length * charWidth + 32;
		const attrWidths = entity.attributes.map((a) => a.name.length * charWidth + 52);
		const maxAttrWidth = attrWidths.length > 0 ? Math.max(...attrWidths) : 0;
		const w = Math.max(160, nameWidth, maxAttrWidth);
		const h = 40 + Math.max(entity.attributes.length, 1) * 24 + 8;
		return { w, h };
	}

	// Estimate total space needed including Chen ovals
	private estimateEntitySpace(entity: Entity): { w: number; h: number } {
		const box = this.estimateEntityBox(entity);
		if (this.notation === 'chen' && entity.attributes.length > 0) {
			// ovals distributed around full circle — reserve ~oval distance per side
			const extra = 120;
			return { w: box.w + extra, h: box.h + extra };
		}
		return box;
	}

	// Animation state
	animating = $state(false);
	private _animationFrameId = 0;

	cancelAnimation() {
		if (this._animationFrameId) {
			cancelAnimationFrame(this._animationFrameId);
			this._animationFrameId = 0;
		}
		this.animating = false;
	}

	/** Compute target layout positions without applying them. Returns null if no entities. */
	private computeLayoutPositions(): { positions: Map<string, Position>; timedOut: boolean } | null {
		const n = this.entities.length;
		if (n === 0) return null;

		if (n === 1) {
			const positions = new Map<string, Position>();
			positions.set(this.entities[0].id, { x: 80, y: 80 });
			return { positions, timedOut: false };
		}

		// Compute entity sizes (box = actual render size, space = including ovals)
		const sizes = new Map<string, { w: number; h: number }>();
		const spaces = new Map<string, { w: number; h: number }>();
		for (const e of this.entities) {
			sizes.set(e.id, this.estimateEntityBox(e));
			spaces.set(e.id, this.estimateEntitySpace(e));
		}

		// Build adjacency list
		const adj = new Map<string, Set<string>>();
		for (const e of this.entities) {
			adj.set(e.id, new Set());
		}
		for (const rel of this.relationships) {
			adj.get(rel.entityIds[0])?.add(rel.entityIds[1]);
			adj.get(rel.entityIds[1])?.add(rel.entityIds[0]);
		}

		// Estimate relationship label sizes for overlap prevention (generous)
		const relLabelBoxes: { relId: string; w: number; h: number }[] = [];
		for (const rel of this.relationships) {
			const isChen = this.notation === 'chen';
			const labelW = isChen ? Math.max(100, rel.name.length * 8 + 40) : rel.name.length * 8 + 30;
			const labelH = isChen ? 55 : 30;
			relLabelBoxes.push({ relId: rel.id, w: labelW, h: labelH });
		}

		// Find connected components
		const visited = new Set<string>();
		const components: string[][] = [];
		for (const e of this.entities) {
			if (visited.has(e.id)) continue;
			const component: string[] = [];
			const queue = [e.id];
			visited.add(e.id);
			while (queue.length > 0) {
				const id = queue.shift()!;
				component.push(id);
				for (const neighbor of adj.get(id) ?? []) {
					if (!visited.has(neighbor)) {
						visited.add(neighbor);
						queue.push(neighbor);
					}
				}
			}
			components.push(component);
		}
		components.sort((a, b) => b.length - a.length);

		// Shuffle helper for variety on each press
		function shuffle<T>(arr: T[]): T[] {
			const a = [...arr];
			for (let i = a.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[a[i], a[j]] = [a[j], a[i]];
			}
			return a;
		}

		const positions = new Map<string, { x: number; y: number }>();
		// Gap between entities — Chen needs more room for oval clouds
		const isChen = this.notation === 'chen';
		const GAP_X = isChen ? 100 : 100;
		const GAP_Y = isChen ? 120 : 150;
		let componentOffsetY = 0;

		for (const component of components) {
			// Pick random root from most-connected
			const degrees = component.map((id) => ({ id, deg: adj.get(id)?.size ?? 0 }));
			degrees.sort((a, b) => b.deg - a.deg);
			const maxDeg = degrees[0].deg;
			const topNodes = degrees.filter((d) => d.deg === maxDeg);
			const rootId = topNodes[Math.floor(Math.random() * topNodes.length)].id;

			// BFS to assign layers
			const layers: string[][] = [];
			const layerOf = new Map<string, number>();
			const bfsQueue = [rootId];
			layerOf.set(rootId, 0);

			while (bfsQueue.length > 0) {
				const id = bfsQueue.shift()!;
				const layer = layerOf.get(id)!;
				if (!layers[layer]) layers[layer] = [];
				layers[layer].push(id);
				for (const neighbor of adj.get(id) ?? []) {
					if (!layerOf.has(neighbor) && component.includes(neighbor)) {
						layerOf.set(neighbor, layer + 1);
						bfsQueue.push(neighbor);
					}
				}
			}

			// Add orphans to layer 0
			for (const id of component) {
				if (!layerOf.has(id)) {
					if (!layers[0]) layers[0] = [];
					layers[0].push(id);
				}
			}

			// Shuffle within each layer
			for (let i = 0; i < layers.length; i++) {
				layers[i] = shuffle(layers[i]);
			}

			// Position entities using space (includes oval room) for spacing
			let layerY = componentOffsetY;
			let maxLayerWidth = 0;

			for (const layer of layers) {
				let totalWidth = 0;
				for (let i = 0; i < layer.length; i++) {
					totalWidth += spaces.get(layer[i])!.w;
					if (i < layer.length - 1) totalWidth += GAP_X;
				}
				maxLayerWidth = Math.max(maxLayerWidth, totalWidth);

				let maxH = 0;
				for (const id of layer) {
					maxH = Math.max(maxH, spaces.get(id)!.h);
				}

				// Position entity at center of its space allocation
				let x = 0;
				for (const id of layer) {
					const sp = spaces.get(id)!;
					const box = sizes.get(id)!;
					// Center the entity box within its allocated space
					positions.set(id, {
						x: x + (sp.w - box.w) / 2,
						y: layerY + (maxH - box.h) / 2
					});
					x += sp.w + GAP_X;
				}

				layerY += maxH + GAP_Y;
			}

			// Center each layer
			for (const layer of layers) {
				let layerWidth = 0;
				for (let i = 0; i < layer.length; i++) {
					layerWidth += spaces.get(layer[i])!.w;
					if (i < layer.length - 1) layerWidth += GAP_X;
				}
				const offset = (maxLayerWidth - layerWidth) / 2;
				for (const id of layer) {
					positions.get(id)!.x += offset;
				}
			}

			componentOffsetY = layerY + GAP_Y;
		}

		// === OVERLAP RESOLUTION using full entity space (includes ovals) ===
		const entityIds = this.entities.map((e) => e.id);
		const PAD = isChen ? 50 : 30;

		const layoutStartTime = Date.now();
		const LAYOUT_TIMEOUT_MS = 5000; // max 5 seconds for entire layout
		let timedOut = false;

		function resolveOverlaps(
			ids: string[],
			pos: Map<string, { x: number; y: number }>,
			sz: Map<string, { w: number; h: number }>,
			pad: number,
			maxPasses: number
		) {
			for (let pass = 0; pass < maxPasses; pass++) {
				if (Date.now() - layoutStartTime > LAYOUT_TIMEOUT_MS) { timedOut = true; break; }
				let moved = false;
				for (let i = 0; i < ids.length; i++) {
					for (let j = i + 1; j < ids.length; j++) {
						const pA = pos.get(ids[i])!;
						const pB = pos.get(ids[j])!;
						const sA = sz.get(ids[i])!;
						const sB = sz.get(ids[j])!;
						// Use space sizes but offset from entity box position
						const boxA = sizes.get(ids[i])!;
						const boxB = sizes.get(ids[j])!;
						const expandA = { w: (sA.w - boxA.w) / 2, h: (sA.h - boxA.h) / 2 };
						const expandB = { w: (sB.w - boxB.w) / 2, h: (sB.h - boxB.h) / 2 };

						const lA = pA.x - expandA.w - pad;
						const rA = pA.x + boxA.w + expandA.w + pad;
						const tA = pA.y - expandA.h - pad;
						const bA = pA.y + boxA.h + expandA.h + pad;
						const lB = pB.x - expandB.w - pad;
						const rB = pB.x + boxB.w + expandB.w + pad;
						const tB = pB.y - expandB.h - pad;
						const bB = pB.y + boxB.h + expandB.h + pad;

						if (rA > lB && lA < rB && bA > tB && tA < bB) {
							moved = true;
							const ox = Math.min(rA - lB, rB - lA);
							const oy = Math.min(bA - tB, bB - tA);
							const cxA = pA.x + boxA.w / 2;
							const cxB = pB.x + boxB.w / 2;
							const cyA = pA.y + boxA.h / 2;
							const cyB = pB.y + boxB.h / 2;
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

		// Phase 1: Resolve entity-entity overlaps
		resolveOverlaps(entityIds, positions, spaces, PAD, 60);

		// Helper: check if line segment from A to B intersects rectangle
		function lineIntersectsRect(
			ax: number, ay: number, bx: number, by: number,
			rl: number, rt: number, rr: number, rb: number
		): boolean {
			// Check if segment AB intersects the axis-aligned rect [rl,rt,rr,rb]
			// Using parametric clipping (Cohen-Sutherland style)
			let tMin = 0, tMax = 1;
			const dx = bx - ax, dy = by - ay;
			const edges = [
				{ p: -dx, q: ax - rl },
				{ p: dx, q: rr - ax },
				{ p: -dy, q: ay - rt },
				{ p: dy, q: rb - ay }
			];
			for (const { p, q } of edges) {
				if (Math.abs(p) < 1e-9) {
					if (q < 0) return false;
				} else {
					const r = q / p;
					if (p < 0) { if (r > tMax) return false; tMin = Math.max(tMin, r); }
					else { if (r < tMin) return false; tMax = Math.min(tMax, r); }
				}
			}
			return tMin <= tMax;
		}

		// Phases 2-3: Alternate between label/line overlap and entity overlap (converge)
		const LABEL_PAD = 30;
		const LINE_PAD = 20;
		for (let iteration = 0; iteration < 8; iteration++) {
			if (Date.now() - layoutStartTime > LAYOUT_TIMEOUT_MS) { timedOut = true; break; }
			let anyMoved = false;

			// Phase 2: Push entities away from relationship labels/diamonds
			for (let pass = 0; pass < 15; pass++) {
				if (Date.now() - layoutStartTime > LAYOUT_TIMEOUT_MS) { timedOut = true; break; }
				let moved = false;
				for (const rel of this.relationships) {
					const posFrom = positions.get(rel.entityIds[0]);
					const posTo = positions.get(rel.entityIds[1]);
					if (!posFrom || !posTo) continue;
					const sFrom = sizes.get(rel.entityIds[0])!;
					const sTo = sizes.get(rel.entityIds[1])!;

					const labelCx = (posFrom.x + sFrom.w / 2 + posTo.x + sTo.w / 2) / 2;
					const labelCy = (posFrom.y + sFrom.h / 2 + posTo.y + sTo.h / 2) / 2;
					const labelInfo = relLabelBoxes.find((r) => r.relId === rel.id);
					if (!labelInfo) continue;

					for (const e of this.entities) {
						if (e.id === rel.entityIds[0] || e.id === rel.entityIds[1]) continue;
						const pos = positions.get(e.id)!;
						const sp = spaces.get(e.id)!;
						const box = sizes.get(e.id)!;
						const expandW = (sp.w - box.w) / 2;
						const expandH = (sp.h - box.h) / 2;

						const entLeft = pos.x - expandW;
						const entRight = pos.x + box.w + expandW;
						const entTop = pos.y - expandH;
						const entBottom = pos.y + box.h + expandH;

						const lLeft = labelCx - labelInfo.w / 2 - LABEL_PAD;
						const lRight = labelCx + labelInfo.w / 2 + LABEL_PAD;
						const lTop = labelCy - labelInfo.h / 2 - LABEL_PAD;
						const lBottom = labelCy + labelInfo.h / 2 + LABEL_PAD;

						if (entRight > lLeft && entLeft < lRight && entBottom > lTop && entTop < lBottom) {
							moved = true;
							anyMoved = true;
							const ox = Math.min(entRight - lLeft, lRight - entLeft);
							const oy = Math.min(entBottom - lTop, lBottom - entTop);
							const ecx = pos.x + box.w / 2;
							const ecy = pos.y + box.h / 2;

							if (ox < oy) {
								const push = ox / 2 + 15;
								pos.x += (ecx < labelCx ? -push : push);
							} else {
								const push = oy / 2 + 15;
								pos.y += (ecy < labelCy ? -push : push);
							}
						}
					}
				}
				if (!moved) break;
			}

			// Phase 2b: Push entities away from relationship lines
			for (let pass = 0; pass < 10; pass++) {
				if (Date.now() - layoutStartTime > LAYOUT_TIMEOUT_MS) { timedOut = true; break; }
				let moved = false;
				for (const rel of this.relationships) {
					const posFrom = positions.get(rel.entityIds[0]);
					const posTo = positions.get(rel.entityIds[1]);
					if (!posFrom || !posTo) continue;
					const sFrom = sizes.get(rel.entityIds[0])!;
					const sTo = sizes.get(rel.entityIds[1])!;

					// Line from center of entityA to center of entityB
					const ax = posFrom.x + sFrom.w / 2;
					const ay = posFrom.y + sFrom.h / 2;
					const bx = posTo.x + sTo.w / 2;
					const by = posTo.y + sTo.h / 2;

					for (const e of this.entities) {
						if (e.id === rel.entityIds[0] || e.id === rel.entityIds[1]) continue;
						const pos = positions.get(e.id)!;
						const box = sizes.get(e.id)!;

						// Entity rect with padding
						const rl = pos.x - LINE_PAD;
						const rt = pos.y - LINE_PAD;
						const rr = pos.x + box.w + LINE_PAD;
						const rb = pos.y + box.h + LINE_PAD;

						if (lineIntersectsRect(ax, ay, bx, by, rl, rt, rr, rb)) {
							moved = true;
							anyMoved = true;
							// Push entity perpendicular to the line direction
							const lineDx = bx - ax;
							const lineDy = by - ay;
							const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
							if (lineLen < 1) continue;
							// Normal perpendicular to line
							const nx = -lineDy / lineLen;
							const ny = lineDx / lineLen;
							// Determine which side of the line the entity center is on
							const ecx = pos.x + box.w / 2;
							const ecy = pos.y + box.h / 2;
							const cross = (ecx - ax) * lineDy - (ecy - ay) * lineDx;
							const sign = cross >= 0 ? 1 : -1;
							const push = 25;
							pos.x += nx * sign * push;
							pos.y += ny * sign * push;
						}
					}
				}
				if (!moved) break;
			}

			// Phase 3: Resolve entity-entity overlaps introduced by pushes
			resolveOverlaps(entityIds, positions, spaces, PAD, 20);

			if (!anyMoved) break;
		}

		// Normalize: shift so top-left starts at (60, 60)
		let minX = Infinity;
		let minY = Infinity;
		for (const pos of positions.values()) {
			minX = Math.min(minX, pos.x);
			minY = Math.min(minY, pos.y);
		}
		const finalPositions = new Map<string, Position>();
		for (const e of this.entities) {
			const pos = positions.get(e.id)!;
			finalPositions.set(e.id, {
				x: Math.round(pos.x - minX + 60),
				y: Math.round(pos.y - minY + 60)
			});
		}

		return { positions: finalPositions, timedOut };
	}

	/** Animated auto-layout: entities slide to new positions. Returns timedOut flag. */
	animateLayout(duration = 500): boolean {
		if (this.diagramType === 'flowchart') { this.flowAutoLayout(); return false; }
		if (this.diagramType === 'context') { this.dfdAutoLayout(); return false; }

		this.cancelAnimation();

		const result = this.computeLayoutPositions();
		if (!result) return false;

		const { positions: targetPositions, timedOut } = result;

		// Save old positions
		const oldPositions = new Map<string, Position>();
		for (const e of this.entities) {
			oldPositions.set(e.id, { ...e.position });
		}

		this.pushHistory('Auto layout');

		// Reset Chen attribute positions to auto-calculate
		if (this.notation === 'chen') {
			for (const entity of this.entities) {
				for (const attr of entity.attributes) {
					delete attr.position;
				}
			}
		}

		this.animating = true;

		const startTime = performance.now();
		const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

		const animate = (now: number) => {
			const elapsed = now - startTime;
			const rawT = Math.min(elapsed / duration, 1);
			const t = easeOutCubic(rawT);

			for (const e of this.entities) {
				const from = oldPositions.get(e.id);
				const to = targetPositions.get(e.id);
				if (from && to) {
					e.position = {
						x: Math.round(from.x + (to.x - from.x) * t),
						y: Math.round(from.y + (to.y - from.y) * t)
					};
				}
			}

			if (rawT < 1) {
				this._animationFrameId = requestAnimationFrame(animate);
			} else {
				// Animation complete
				this._animationFrameId = 0;
				this.animating = false;
				this.panX = 0;
				this.panY = 0;
				this.zoom = 1;

				// Sync to collaborators once at end
				const c = getCollab();
				if (c) {
					for (const e of this.entities) c.pushEntityChange(e);
				}
			}
		};

		this._animationFrameId = requestAnimationFrame(animate);
		return timedOut;
	}

	// Auto-layout: dispatch by diagram type. Returns true if layout timed out.
	autoLayout(): boolean {
		return this.animateLayout();
	}

	// Selection
	selectEntity(id: string | null) {
		this.selectedNodeIds = id ? [id] : [];
		this.selectedEdgeId = null;
	}

	selectEntities(ids: string[]) {
		this.selectedNodeIds = [...ids];
		this.selectedEdgeId = null;
	}

	toggleEntitySelection(id: string) {
		if (this.selectedNodeIdSet.has(id)) {
			this.selectedNodeIds = this.selectedNodeIds.filter((eid) => eid !== id);
		} else {
			this.selectedNodeIds = [...this.selectedNodeIds, id];
		}
		this.selectedEdgeId = null;
	}

	selectRelationship(id: string | null) {
		this.selectedEdgeId = id;
		this.selectedNodeIds = [];
	}

	clearSelection() {
		this.selectedNodeIds = [];
		this.selectedEdgeId = null;
	}

	selectAll() {
		this.selectedNodeIds = this.entities.map((e) => e.id);
		this.selectedEdgeId = null;
	}

	copySelected() {
		if (this.selectedNodeIds.length === 0) return;
		const ents = this.entities.filter((e) => this.selectedNodeIdSet.has(e.id));
		this.clipboard = JSON.stringify(ents);
	}

	paste() {
		if (!this.clipboard) return;
		try {
			const ents = JSON.parse(this.clipboard) as Entity[];
			this.pushHistory('Paste');
			const newIds: string[] = [];
			for (const e of ents) {
				const newId = generateId();
				const entity: Entity = {
					id: newId,
					name: e.name + ' (copy)',
					attributes: e.attributes.map((a) => ({ ...a, id: generateId() })),
					position: { x: e.position.x + 30, y: e.position.y + 30 },
					isWeak: e.isWeak,
					color: e.color
				};
				this.entities.push(entity);
				getCollab()?.pushEntityChange(entity);
				newIds.push(newId);
			}
			this.selectedNodeIds = newIds;
		} catch { /* invalid clipboard */ }
	}

	toggleGrid() {
		this.showGrid = !this.showGrid;
	}

	restoreHistoryEntry(index: number) {
		if (index < 0 || index >= this.history.length) return;
		this.pushHistory('Restore');
		this.restore(this.history[index]);
	}

	applyTranslation(mapping: {
		entities: Record<string, string>;
		attributes: Record<string, string>;
		relationships: Record<string, string>;
	}) {
		this.pushHistory();
		for (const entity of this.entities) {
			if (mapping.entities[entity.name]) {
				entity.name = mapping.entities[entity.name];
			}
			for (const attr of entity.attributes) {
				if (mapping.attributes[attr.name]) {
					attr.name = mapping.attributes[attr.name];
				}
			}
		}
		for (const rel of this.relationships) {
			if (mapping.relationships[rel.name]) {
				rel.name = mapping.relationships[rel.name];
			}
		}
		// Sync translation to collaborators
		const c = getCollab();
		if (c) {
			for (const e of this.entities) c.pushEntityChange(e);
			for (const r of this.relationships) c.pushRelationshipChange(r);
		}
	}

	// Note CRUD
	private noteColorCycle: NoteColor[] = ['yellow', 'blue', 'green', 'red', 'purple'];
	private noteColorIndex = 0;

	addNote(text: string, position?: Position, color?: NoteColor): Note {
		this.pushHistory('Add note');
		const noteColor = color ?? this.noteColorCycle[this.noteColorIndex % this.noteColorCycle.length];
		this.noteColorIndex++;
		const note: Note = {
			id: generateId(),
			text,
			position: position ?? {
				x: (-this.panX + 400) / this.zoom,
				y: (-this.panY + 300) / this.zoom
			},
			color: noteColor
		};
		this.notes.push(note);
		getCollab()?.pushNoteChange(note);
		return note;
	}

	updateNote(id: string, text: string) {
		const note = this.notes.find((n) => n.id === id);
		if (!note) return;
		this.pushHistory('Edit note');
		note.text = text;
		getCollab()?.pushNoteChange(note);
	}

	removeNote(id: string) {
		this.pushHistory('Remove note');
		this.notes = this.notes.filter((n) => n.id !== id);
		getCollab()?.pushNoteRemove(id);
	}

	moveNote(id: string, position: Position) {
		const note = this.notes.find((n) => n.id === id);
		if (note) {
			if (this.showGrid) {
				position = {
					x: Math.round(position.x / 20) * 20,
					y: Math.round(position.y / 20) * 20
				};
			}
			note.position = position;
			getCollab()?.pushNoteChange(note);
		}
	}

	// ─── Flowchart CRUD ───

	addFlowNode(name: string, type: FlowNodeType = 'process', position?: Position): FlowNode {
		this.pushHistory('Add flow node');
		const node: FlowNode = {
			id: generateId(),
			name,
			type,
			position: position ?? this.getNextPosition()
		};
		this.flowNodes.push(node);
		this.selectedNodeIds = [node.id];
		this.newEntityIds = new Set([...this.newEntityIds, node.id]);
		setTimeout(() => { this.newEntityIds = new Set([...this.newEntityIds].filter(id => id !== node.id)); }, 600);
		getCollab()?.pushFlowNodeChange(node);
		return node;
	}

	updateFlowNode(id: string, updates: Partial<Pick<FlowNode, 'name' | 'type' | 'color' | 'borderRadius'>>) {
		const node = this.flowNodes.find((n) => n.id === id);
		if (!node) return;
		this.pushHistory();
		if (updates.name !== undefined) node.name = updates.name;
		if (updates.type !== undefined) node.type = updates.type;
		if (updates.color !== undefined) node.color = updates.color;
		if (updates.borderRadius !== undefined) node.borderRadius = updates.borderRadius;
		getCollab()?.pushFlowNodeChange(node);
	}

	removeFlowNode(id: string) {
		this.pushHistory('Remove flow node');
		const c = getCollab();
		for (const e of this.flowEdges) {
			if (e.fromNodeId === id || e.toNodeId === id) c?.pushFlowEdgeRemove(e.id);
		}
		this.flowEdges = this.flowEdges.filter((e) => e.fromNodeId !== id && e.toNodeId !== id);
		this.flowNodes = this.flowNodes.filter((n) => n.id !== id);
		this.selectedNodeIds = this.selectedNodeIds.filter((nid) => nid !== id);
		c?.pushFlowNodeRemove(id);
	}

	moveFlowNode(id: string, position: Position) {
		const node = this.flowNodes.find((n) => n.id === id);
		if (node) {
			if (this.showGrid) {
				position = { x: Math.round(position.x / 20) * 20, y: Math.round(position.y / 20) * 20 };
			}
			node.position = position;
			getCollab()?.pushFlowNodeChange(node);
		}
	}

	addFlowEdge(label: string, fromNodeId: string, toNodeId: string, condition?: 'yes' | 'no'): FlowEdge {
		this.pushHistory('Add flow edge');
		const edge: FlowEdge = { id: generateId(), label, fromNodeId, toNodeId, condition };
		this.flowEdges.push(edge);
		this.selectedEdgeId = edge.id;
		getCollab()?.pushFlowEdgeChange(edge);
		return edge;
	}

	updateFlowEdge(id: string, updates: Partial<Pick<FlowEdge, 'label' | 'condition'>>) {
		const edge = this.flowEdges.find((e) => e.id === id);
		if (!edge) return;
		this.pushHistory();
		if (updates.label !== undefined) edge.label = updates.label;
		if (updates.condition !== undefined) edge.condition = updates.condition;
		getCollab()?.pushFlowEdgeChange(edge);
	}

	removeFlowEdge(id: string) {
		this.pushHistory('Remove flow edge');
		this.flowEdges = this.flowEdges.filter((e) => e.id !== id);
		if (this.selectedEdgeId === id) this.selectedEdgeId = null;
		getCollab()?.pushFlowEdgeRemove(id);
	}

	// ─── Context Diagram (DFD) CRUD ───

	addDFDNode(name: string, type: DFDNodeType = 'process', position?: Position): DFDNode {
		this.pushHistory('Add DFD node');
		const node: DFDNode = {
			id: generateId(),
			name,
			type,
			position: position ?? this.getNextPosition()
		};
		this.dfdNodes.push(node);
		this.selectedNodeIds = [node.id];
		this.newEntityIds = new Set([...this.newEntityIds, node.id]);
		setTimeout(() => { this.newEntityIds = new Set([...this.newEntityIds].filter(id => id !== node.id)); }, 600);
		getCollab()?.pushDFDNodeChange(node);
		return node;
	}

	updateDFDNode(id: string, updates: Partial<Pick<DFDNode, 'name' | 'type' | 'processNumber' | 'color'>>) {
		const node = this.dfdNodes.find((n) => n.id === id);
		if (!node) return;
		this.pushHistory();
		if (updates.name !== undefined) node.name = updates.name;
		if (updates.type !== undefined) node.type = updates.type;
		if (updates.processNumber !== undefined) node.processNumber = updates.processNumber;
		if (updates.color !== undefined) node.color = updates.color;
		getCollab()?.pushDFDNodeChange(node);
	}

	removeDFDNode(id: string) {
		this.pushHistory('Remove DFD node');
		const c = getCollab();
		for (const f of this.dfdFlows) {
			if (f.fromNodeId === id || f.toNodeId === id) c?.pushDFDFlowRemove(f.id);
		}
		this.dfdFlows = this.dfdFlows.filter((f) => f.fromNodeId !== id && f.toNodeId !== id);
		this.dfdNodes = this.dfdNodes.filter((n) => n.id !== id);
		this.selectedNodeIds = this.selectedNodeIds.filter((nid) => nid !== id);
		c?.pushDFDNodeRemove(id);
	}

	moveDFDNode(id: string, position: Position) {
		const node = this.dfdNodes.find((n) => n.id === id);
		if (node) {
			if (this.showGrid) {
				position = { x: Math.round(position.x / 20) * 20, y: Math.round(position.y / 20) * 20 };
			}
			node.position = position;
			getCollab()?.pushDFDNodeChange(node);
		}
	}

	addDFDFlow(label: string, fromNodeId: string, toNodeId: string): DFDFlow {
		this.pushHistory('Add DFD flow');
		const flow: DFDFlow = { id: generateId(), label, fromNodeId, toNodeId };
		this.dfdFlows.push(flow);
		this.selectedEdgeId = flow.id;
		getCollab()?.pushDFDFlowChange(flow);
		return flow;
	}

	updateDFDFlow(id: string, updates: Partial<Pick<DFDFlow, 'label'>>) {
		const flow = this.dfdFlows.find((f) => f.id === id);
		if (!flow) return;
		this.pushHistory();
		if (updates.label !== undefined) flow.label = updates.label;
		getCollab()?.pushDFDFlowChange(flow);
	}

	removeDFDFlow(id: string) {
		this.pushHistory('Remove DFD flow');
		this.dfdFlows = this.dfdFlows.filter((f) => f.id !== id);
		if (this.selectedEdgeId === id) this.selectedEdgeId = null;
		getCollab()?.pushDFDFlowRemove(id);
	}

	// Duplicate selected nodes
	duplicateSelected() {
		if (this.selectedNodeIds.length === 0) return;
		this.pushHistory('Duplicate');
		const newIds: string[] = [];

		if (this.diagramType === 'er') {
			for (const id of this.selectedNodeIds) {
				const src = this.entities.find((e) => e.id === id);
				if (!src) continue;
				const newId = generateId();
				const entity: Entity = {
					id: newId,
					name: src.name + ' (copy)',
					attributes: src.attributes.map((a) => ({ ...a, id: generateId() })),
					position: { x: src.position.x + 30, y: src.position.y + 30 },
					isWeak: src.isWeak,
					color: src.color
				};
				this.entities.push(entity);
				getCollab()?.pushEntityChange(entity);
				newIds.push(newId);
			}
		} else if (this.diagramType === 'flowchart') {
			for (const id of this.selectedNodeIds) {
				const src = this.flowNodes.find((n) => n.id === id);
				if (!src) continue;
				const newId = generateId();
				const node: FlowNode = {
					id: newId,
					name: src.name + ' (copy)',
					type: src.type,
					position: { x: src.position.x + 30, y: src.position.y + 30 },
					color: src.color
				};
				this.flowNodes.push(node);
				getCollab()?.pushFlowNodeChange(node);
				newIds.push(newId);
			}
		} else if (this.diagramType === 'context') {
			for (const id of this.selectedNodeIds) {
				const src = this.dfdNodes.find((n) => n.id === id);
				if (!src) continue;
				const newId = generateId();
				const node: DFDNode = {
					id: newId,
					name: src.name + ' (copy)',
					type: src.type,
					processNumber: src.processNumber,
					position: { x: src.position.x + 30, y: src.position.y + 30 },
					color: src.color
				};
				this.dfdNodes.push(node);
				getCollab()?.pushDFDNodeChange(node);
				newIds.push(newId);
			}
		}

		this.selectedNodeIds = newIds;
	}

	// Flowchart auto-layout: top-down hierarchical
	flowAutoLayout() {
		const n = this.flowNodes.length;
		if (n === 0) return;
		this.pushHistory('Auto layout');

		const GAP_X = 180;
		const GAP_Y = 120;

		// Build directed adjacency from flowEdges
		const children = new Map<string, string[]>();
		const inDegree = new Map<string, number>();
		for (const node of this.flowNodes) {
			children.set(node.id, []);
			inDegree.set(node.id, 0);
		}
		for (const edge of this.flowEdges) {
			children.get(edge.fromNodeId)?.push(edge.toNodeId);
			inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) ?? 0) + 1);
		}

		// Find roots: prefer start-end nodes with no incoming, then any with no incoming
		let roots = this.flowNodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0 && n.type === 'start-end').map((n) => n.id);
		if (roots.length === 0) {
			roots = this.flowNodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
		}
		if (roots.length === 0) roots = [this.flowNodes[0].id];

		// BFS layering
		const layers: string[][] = [];
		const layerOf = new Map<string, number>();
		const queue = [...roots];
		for (const r of roots) layerOf.set(r, 0);

		while (queue.length > 0) {
			const id = queue.shift()!;
			const layer = layerOf.get(id)!;
			if (!layers[layer]) layers[layer] = [];
			layers[layer].push(id);
			for (const child of children.get(id) ?? []) {
				if (!layerOf.has(child)) {
					layerOf.set(child, layer + 1);
					queue.push(child);
				}
			}
		}

		// Add unvisited nodes to last layer
		for (const node of this.flowNodes) {
			if (!layerOf.has(node.id)) {
				const lastLayer = layers.length;
				if (!layers[lastLayer]) layers[lastLayer] = [];
				layers[lastLayer].push(node.id);
			}
		}

		// Position nodes
		let maxLayerWidth = 0;
		for (const layer of layers) {
			maxLayerWidth = Math.max(maxLayerWidth, layer.length);
		}

		const positions = new Map<string, { x: number; y: number }>();
		for (let li = 0; li < layers.length; li++) {
			const layer = layers[li];
			const totalWidth = (layer.length - 1) * GAP_X;
			const startX = -totalWidth / 2;
			for (let ni = 0; ni < layer.length; ni++) {
				positions.set(layer[ni], { x: startX + ni * GAP_X, y: li * GAP_Y });
			}
		}

		// Normalize to start at (60, 60)
		let minX = Infinity, minY = Infinity;
		for (const pos of positions.values()) {
			minX = Math.min(minX, pos.x);
			minY = Math.min(minY, pos.y);
		}
		const c = getCollab();
		for (const node of this.flowNodes) {
			const pos = positions.get(node.id);
			if (pos) {
				node.position = {
					x: Math.round(pos.x - minX + 60),
					y: Math.round(pos.y - minY + 60)
				};
				c?.pushFlowNodeChange(node);
			}
		}

		this.panX = 0;
		this.panY = 0;
		this.zoom = 1;
	}

	// DFD auto-layout: radial (process center, externals around)
	dfdAutoLayout() {
		const n = this.dfdNodes.length;
		if (n === 0) return;
		this.pushHistory('Auto layout');

		const processes = this.dfdNodes.filter((n) => n.type === 'process');
		const externals = this.dfdNodes.filter((n) => n.type === 'external-entity');
		const stores = this.dfdNodes.filter((n) => n.type === 'data-store');

		const centerX = 400;
		const centerY = 300;
		const radius = 250;

		// Main process at center
		if (processes.length > 0) {
			processes[0].position = { x: centerX, y: centerY };
		}

		// Additional processes in inner ring
		if (processes.length > 1) {
			const innerRadius = 130;
			for (let i = 1; i < processes.length; i++) {
				const angle = ((i - 1) / (processes.length - 1)) * Math.PI * 2;
				processes[i].position = {
					x: Math.round(centerX + Math.cos(angle) * innerRadius),
					y: Math.round(centerY + Math.sin(angle) * innerRadius)
				};
			}
		}

		// External entities in outer ring
		for (let i = 0; i < externals.length; i++) {
			const angle = (i / Math.max(externals.length, 1)) * Math.PI * 2 - Math.PI / 2;
			externals[i].position = {
				x: Math.round(centerX + Math.cos(angle) * radius),
				y: Math.round(centerY + Math.sin(angle) * radius)
			};
		}

		// Data stores at bottom row
		const storeStartX = centerX - ((stores.length - 1) * 180) / 2;
		for (let i = 0; i < stores.length; i++) {
			stores[i].position = {
				x: Math.round(storeStartX + i * 180),
				y: centerY + radius + 80
			};
		}

		// Normalize to start at (60, 60)
		let minX = Infinity, minY = Infinity;
		for (const node of this.dfdNodes) {
			minX = Math.min(minX, node.position.x);
			minY = Math.min(minY, node.position.y);
		}
		const c = getCollab();
		for (const node of this.dfdNodes) {
			node.position = {
				x: Math.round(node.position.x - minX + 60),
				y: Math.round(node.position.y - minY + 60)
			};
			c?.pushDFDNodeChange(node);
		}

		this.panX = 0;
		this.panY = 0;
		this.zoom = 1;
	}

	resetAll() {
		this.diagramType = 'er';
		this.entities = [];
		this.relationships = [];
		this.notes = [];
		this.notation = 'crows-foot';
		this.flowNodes = [];
		this.flowEdges = [];
		this.dfdNodes = [];
		this.dfdFlows = [];
		this.diagramFont = "'TH Sarabun PSK', 'Sarabun', sans-serif";
		this.panX = 0;
		this.panY = 0;
		this.zoom = 1;
		this.selectedNodeIds = [];
		this.selectedEdgeId = null;
		this.history = [];
		this.historyLabels = [];
		this.future = [];
		this.futureLabels = [];
		this.clipboard = null;
		this.showGrid = false;
	}
}

export const diagram = new DiagramState();
