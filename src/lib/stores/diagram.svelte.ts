import { getDFDPorts } from '$lib/utils/dfd-ports';
import { validateDFD } from '$lib/utils/dfd-validation';
import type { Entity, Attribute, Relationship, CardinalityType, Note, NoteColor } from '$lib/types/er';
import type { NotationStyle } from '$lib/types/notation';
import type { Position } from '$lib/types/geometry';
import type { DiagramType } from '$lib/types/diagram';
import type { FlowNode, FlowNodeType, FlowEdge } from '$lib/types/flowchart';
import type { DFDNode, DFDNodeType, DFDFlow, DFDSide } from '$lib/types/context-diagram';
import type { CustomFont } from '$lib/types/session';
import type { Comment, CommentTargetType } from '$lib/types/comment';
import { generateId } from '$lib/utils/id';
import { toast } from './toast.svelte';
import type { PhysicsSimulation } from '$lib/utils/physics-simulation';
import { autoSizeFlowNode } from '$lib/utils/flow-node-size';
import { storableAttributes, sampleValue } from '$lib/utils/er-to-sqlite';
import type { SampleCell, SampleRow } from '$lib/types/er';

let _elkPromise: Promise<typeof import('$lib/utils/elk-layout')> | null = null;
function getElk() {
	if (!_elkPromise) _elkPromise = import('$lib/utils/elk-layout');
	return _elkPromise;
}

if (typeof window !== 'undefined') getElk().catch(() => {});


let _collab: typeof import('./collab.svelte')['collab'] | null = null;
function getCollab() {
	if (!_collab) {
		try {
			// Dynamic require won't work in ESM; we set this from collab.svelte.ts instead
		} catch { /* noop */ }
	}
	return _collab;
}

export function registerCollab(c: typeof _collab) {
	_collab = c;
}

export class DiagramState {
	async replaceContent(parts: Partial<Pick<DiagramState, 'entities' | 'relationships' | 'flowNodes' | 'flowEdges' | 'dfdNodes' | 'dfdFlows' | 'notation'>>, label = 'Import', layout = false): Promise<boolean> {
		if (this.viewOnly || getCollab()?.isViewer) return false;
		const type = this.diagramType, parent = this.dfdCurrentParentId;
		const ids = [...new Set([...this.editableItemIds, ...Object.values(parts).filter(Array.isArray).flat().map(item => item.id)])];
		const operation = async () => {
			if (type !== this.diagramType || parent !== this.dfdCurrentParentId) throw new Error('ไดอะแกรมเปลี่ยนระหว่างรอ');
			this.pushHistory(label);
			if (parts.notation) this.notation = parts.notation;
			if (parts.entities) this.entities = parts.entities;
			if (parts.relationships) this.relationships = parts.relationships;
			if (parts.flowNodes) this.flowNodes = parts.flowNodes;
			if (parts.flowEdges) this.flowEdges = parts.flowEdges;
			if (parts.dfdNodes) this.dfdNodes = parts.dfdNodes;
			if (parts.dfdFlows) this.dfdFlows = parts.dfdFlows;
			this.clearSelection();
			getCollab()?.pushFullState();
			if (layout) this.autoLayout();
			await this.waitForEdits();
		};
		const c = getCollab();
		if (c?.connected) return c.runLocked(ids, operation);
		await operation();
		return true;
	}

	async replaceDFDLevel(nodes: DFDNode[], flows: DFDFlow[], label = 'Import DFD', layout = true) {
		const parentId = this.dfdCurrentParentId;
		const current = this.dfdVisibleNodes;
		const idMap = new Map(nodes.map(n => [n.id, current.find(old => old.name === n.name && old.type === n.type)?.id ?? n.id]));
		const replacement = nodes.map(n => ({ ...n, id: idMap.get(n.id)!, parentId }));
		const kept = new Set(replacement.map(n => n.id));
		const removed = new Set(current.filter(n => !kept.has(n.id)).flatMap(n => [n.id, ...this._dfdDescendantNodeIds(n.id)]));
		return this.replaceContent({
			dfdNodes: [...this.dfdNodes.filter(n => (n.parentId ?? undefined) !== parentId && !removed.has(n.id)), ...replacement],
			dfdFlows: [...this.dfdFlows.filter(f => (f.parentId ?? undefined) !== parentId && !removed.has(f.fromNodeId) && !removed.has(f.toNodeId) && !(f.parentId && removed.has(f.parentId))), ...flows.map(f => ({ ...f, fromNodeId: idMap.get(f.fromNodeId) ?? f.fromNodeId, toNodeId: idMap.get(f.toNodeId) ?? f.toNodeId, parentId }))]
		}, label, layout);
	}
	get editableItemIds(): string[] {
		return [...this.entities, ...this.relationships, ...this.flowNodes, ...this.flowEdges, ...this.dfdNodes, ...this.dfdFlows, ...this.notes].map(item => item.id);
	}

	private editDependencies(ids: string[]): string[] {
		const nodes = new Set(ids);
		for (const id of ids) for (const child of this._dfdDescendantNodeIds(id)) nodes.add(child);
		return [...new Set([...nodes,
			...this.relationships.filter(r => r.entityIds.some(id => nodes.has(id))).map(r => r.id),
			...this.flowEdges.filter(e => nodes.has(e.fromNodeId) || nodes.has(e.toNodeId)).map(e => e.id),
			...this.dfdFlows.filter(f => nodes.has(f.fromNodeId) || nodes.has(f.toNodeId) || (f.parentId && nodes.has(f.parentId))).map(f => f.id)
		])];
	}

	private deferEdit(ids: string[], operation: () => void): boolean {
		if (this.viewOnly || getCollab()?.isViewer) return true;
		const c = getCollab();
		if (c?.connected && !ids.every(id => c.canEdit(id))) {
			void c.runLocked(ids, operation);
			return true;
		}
		return false;
	}


	diagramType = $state<DiagramType>('er');


	entities = $state<Entity[]>([]);
	relationships = $state<Relationship[]>([]);
	notes = $state<Note[]>([]);
	comments = $state<Comment[]>([]);

	openCommentsPanel: (() => void) | null = null;
	notation = $state<NotationStyle>('crows-foot');


	flowNodes = $state<FlowNode[]>([]);
	flowEdges = $state<FlowEdge[]>([]);



	stampShape = $state<FlowNodeType | null>(null);


	dfdNodes = $state<DFDNode[]>([]);
	dfdFlows = $state<DFDFlow[]>([]);






	dfdDrillPath = $state<string[]>([]);
	dfdIssues = $derived(validateDFD(this.dfdNodes, this.dfdFlows));


	dfdCurrentParentId = $derived(
		this.dfdDrillPath.length > 0 ? this.dfdDrillPath[this.dfdDrillPath.length - 1] : undefined
	);


	dfdBreadcrumb = $derived.by((): { id: string | null; name: string }[] => {
		const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Context (Level 0)' }];
		let level = 1;
		for (const pid of this.dfdDrillPath) {
			const parent = this.dfdNodes.find((n) => n.id === pid);
			const label = parent ? parent.name || `Process ${parent.processNumber ?? ''}`.trim() : 'Process';
			crumbs.push({ id: pid, name: `${label} (Level ${level})` });
			level++;
		}
		return crumbs;
	});


	dfdVisibleNodes = $derived(
		this.dfdNodes.filter((n) => (n.parentId ?? undefined) === this.dfdCurrentParentId)
	);
	dfdVisibleFlows = $derived(
		this.dfdFlows.filter((f) => (f.parentId ?? undefined) === this.dfdCurrentParentId)
	);



	dfdNodesWithChildren = $derived.by((): Set<string> => {
		const set = new Set<string>();
		for (const n of this.dfdNodes) if (n.parentId) set.add(n.parentId);
		return set;
	});












	dfdFlowPortOffsets = $derived(getDFDPorts(this.dfdNodes, this.dfdVisibleFlows));


	selectedNodeIds = $state<string[]>([]);
	selectedEdgeId = $state<string | null>(null);
	selectedFlowEdgeIds = $state<string[]>([]);


	selectedNodeIdSet = $derived(new Set(this.selectedNodeIds));


	selectedEntityId = $derived(
		this.selectedNodeIds.length === 1 ? this.selectedNodeIds[0] : null
	);


	diagramFont = $state("'Kanit', sans-serif");


	diagramFontSize = $state(14);


	customFonts = $state<CustomFont[]>([]);


	panX = $state(0);
	panY = $state(0);
	zoom = $state(1);


	bookmarks = $state<Map<number, { panX: number; panY: number; zoom: number }>>(new Map());


	canvasWidth = $state(0);
	canvasHeight = $state(0);




	private history = $state<string[]>([]);
	private historyLabels = $state<string[]>([]);
	private future = $state<string[]>([]);
	private futureLabels = $state<string[]>([]);
	private get maxHistory(): number {


		const totalItems = this.entities.length + this.flowNodes.length + this.dfdNodes.length;
		if (totalItems > 200) return 8;
		if (totalItems > 100) return 12;
		return 20;
	}


	private clipboard: string | null = null;


	showGrid = $state(false);


	sketchMode = $state(false);



	smartRouting = $state(true);


	viewOnly = $state(false);


	_skipHistory = false;


	newEntityIds = $state<Set<string>>(new Set());
	dyingEntities = $state<Array<Entity & { _dyingRect?: { x: number; y: number; width: number; height: number } }>>([]);


	newRelationshipIds = $state<Set<string>>(new Set());


	dyingRelationshipIds = $state<Set<string>>(new Set());


	dyingFlowNodes = $state<Array<FlowNode & { _dyingRect?: { x: number; y: number; width: number; height: number } }>>([]);


	dyingFlowEdgeIds = $state<Set<string>>(new Set());


	dyingDFDNodes = $state<Array<DFDNode & { _dyingRect?: { x: number; y: number; width: number; height: number } }>>([]);


	newDFDFlowIds = $state<Set<string>>(new Set());
	dyingDFDFlowIds = $state<Set<string>>(new Set());


	showDataFlow = $state(false);


	localDraggingIds = $state<Set<string>>(new Set());


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


	smoothTransition = $state(false);


	notationTransitioning = $state(false);
	notationAppearing = $state(false);

	notationRelPhase = $state<'undraw' | 'hidden' | 'draw' | null>(null);

	notationMorphing = $state(false);

	notationOvalsAppearing = $state(false);


	timelinePreviewActive = $state(false);
	private _previewSavedState: string | null = null;


	get canUndo() { return this.history.length > 0; }
	get canRedo() { return this.future.length > 0; }
	get historyEntries() { return this.historyLabels; }
	get historySnapshots(): string[] { return this.history; }
	get historyLength(): number { return this.history.length; }


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


	commentTarget = $derived.by((): { id: string; type: CommentTargetType; name: string } | null => {
		const nodeId = this.selectedNodeIds.length === 1 ? this.selectedNodeIds[0] : null;
		if (nodeId) {
			if (this.diagramType === 'er') {
				const e = this.entityMap.get(nodeId);
				if (e) return { id: e.id, type: 'entity', name: e.name };
			} else if (this.diagramType === 'flowchart') {
				const n = this.flowNodes.find((x) => x.id === nodeId);
				if (n) return { id: n.id, type: 'flowNode', name: n.name || 'Node' };
			} else {
				const n = this.dfdNodes.find((x) => x.id === nodeId);
				if (n) return { id: n.id, type: 'dfdNode', name: n.name || 'Node' };
			}
		}
		if (this.selectedEdgeId) {
			const eid = this.selectedEdgeId;
			if (this.diagramType === 'er') {
				const r = this.relationships.find((x) => x.id === eid);
				if (r) return { id: r.id, type: 'relationship', name: r.name || 'Relationship' };
			} else if (this.diagramType === 'flowchart') {
				const e = this.flowEdges.find((x) => x.id === eid);
				if (e) return { id: e.id, type: 'flowEdge', name: e.label || 'Edge' };
			} else {
				const f = this.dfdFlows.find((x) => x.id === eid);
				if (f) return { id: f.id, type: 'dfdFlow', name: f.label || 'Flow' };
			}
		}
		return null;
	});


	private snapshot(): string {
		return JSON.stringify({
			entities: this.entities,
			relationships: this.relationships,
			notes: this.notes,
			comments: this.comments,
			flowNodes: this.flowNodes,
			flowEdges: this.flowEdges,
			dfdNodes: this.dfdNodes,
			dfdFlows: this.dfdFlows
		});
	}

	private restore(json: string) {
		const data = JSON.parse(json);



		const wasDying = new Set(this.dyingRelationshipIds);


		this.dyingRelationshipIds = new Set();



		const oldRelIds = new Set(
			this.relationships.filter(r => !wasDying.has(r.id)).map(r => r.id)
		);
		const newRels: typeof this.relationships = data.relationships;
		const newRelIds = new Set(newRels.map(r => r.id));


		const restoredIds = newRels.filter(r => !oldRelIds.has(r.id)).map(r => r.id);

		const removedRels = this.relationships.filter(r => !newRelIds.has(r.id));
		const removedIds = removedRels.map(r => r.id);


		if (restoredIds.length > 0) {
			this.newRelationshipIds = new Set([...this.newRelationshipIds, ...restoredIds]);
			setTimeout(() => {
				this.newRelationshipIds = new Set(
					[...this.newRelationshipIds].filter(id => !restoredIds.includes(id))
				);
			}, 3500);
		}


		if (removedIds.length > 0) {
			this.dyingRelationshipIds = new Set([...this.dyingRelationshipIds, ...removedIds]);

			this.relationships = [...newRels, ...removedRels];
			setTimeout(() => {
				this.relationships = this.relationships.filter(r => !removedIds.includes(r.id));
				this.dyingRelationshipIds = new Set(
					[...this.dyingRelationshipIds].filter(id => !removedIds.includes(id))
				);
			}, 2500);
		} else {
			this.relationships = newRels;
		}


		const oldEntIds = new Set(this.entities.map(e => e.id));
		const newEnts: typeof this.entities = data.entities;
		const newEntIds = new Set(newEnts.map(e => e.id));


		const restoredEntIds = newEnts.filter(e => !oldEntIds.has(e.id)).map(e => e.id);
		if (restoredEntIds.length > 0) {
			this.newEntityIds = new Set([...this.newEntityIds, ...restoredEntIds]);
			setTimeout(() => {
				this.newEntityIds = new Set(
					[...this.newEntityIds].filter(id => !restoredEntIds.includes(id))
				);
			}, 600);
		}


		const removedEnts = this.entities.filter(e => !newEntIds.has(e.id));
		if (removedEnts.length > 0) {
			const dyingEnts = removedEnts.map(e => {
				const box = this.estimateEntityBox(e);
				return { ...e, _dyingRect: { x: e.position.x, y: e.position.y, width: box.w, height: box.h } };
			});
			this.dyingEntities = [...this.dyingEntities, ...dyingEnts];
			const dyingIds = new Set(removedEnts.map(e => e.id));
			setTimeout(() => { this.dyingEntities = this.dyingEntities.filter(e => !dyingIds.has(e.id)); }, 900);
		}

		this.entities = newEnts;
		this.notes = data.notes ?? [];
		this.comments = data.comments ?? [];
		this.flowNodes = data.flowNodes ?? [];
		this.flowEdges = data.flowEdges ?? [];
		for (const n of this.flowNodes) autoSizeFlowNode(n, this.diagramFontSize);


		const wasDyingDFDFlows = new Set(this.dyingDFDFlowIds);
		this.dyingDFDFlowIds = new Set();

		const oldDFDNodeIds = new Set(this.dfdNodes.map(n => n.id));
		const newDFDNodes: typeof this.dfdNodes = data.dfdNodes ?? [];
		const newDFDNodeIds = new Set(newDFDNodes.map(n => n.id));


		const restoredDFDNodeIds = newDFDNodes.filter(n => !oldDFDNodeIds.has(n.id)).map(n => n.id);
		if (restoredDFDNodeIds.length > 0) {
			this.newEntityIds = new Set([...this.newEntityIds, ...restoredDFDNodeIds]);
			setTimeout(() => {
				this.newEntityIds = new Set(
					[...this.newEntityIds].filter(id => !restoredDFDNodeIds.includes(id))
				);
			}, 600);
		}


		const removedDFDNodes = this.dfdNodes.filter(n => !newDFDNodeIds.has(n.id));
		if (removedDFDNodes.length > 0) {
			const dyingDFDEnts = removedDFDNodes.map(n => {
				const rect = this._getDFDNodeRect(n);
				return { ...n, _dyingRect: rect };
			});
			this.dyingDFDNodes = [...this.dyingDFDNodes, ...dyingDFDEnts];
			const dyingIds = new Set(removedDFDNodes.map(n => n.id));
			setTimeout(() => { this.dyingDFDNodes = this.dyingDFDNodes.filter(n => !dyingIds.has(n.id)); }, 900);
		}

		this.dfdNodes = newDFDNodes;


		const oldDFDFlowIds = new Set(
			this.dfdFlows.filter(f => !wasDyingDFDFlows.has(f.id)).map(f => f.id)
		);
		const newDFDFlows: typeof this.dfdFlows = data.dfdFlows ?? [];
		const newDFDFlowIds = new Set(newDFDFlows.map(f => f.id));


		const restoredDFDFlowIds = newDFDFlows.filter(f => !oldDFDFlowIds.has(f.id)).map(f => f.id);
		if (restoredDFDFlowIds.length > 0) {
			this.newDFDFlowIds = new Set([...this.newDFDFlowIds, ...restoredDFDFlowIds]);
			setTimeout(() => {
				this.newDFDFlowIds = new Set(
					[...this.newDFDFlowIds].filter(id => !restoredDFDFlowIds.includes(id))
				);
			}, 3500);
		}


		const removedDFDFlows = this.dfdFlows.filter(f => !newDFDFlowIds.has(f.id));
		const removedDFDFlowIdList = removedDFDFlows.map(f => f.id);
		if (removedDFDFlowIdList.length > 0) {
			this.dyingDFDFlowIds = new Set([...this.dyingDFDFlowIds, ...removedDFDFlowIdList]);

			this.dfdFlows = [...newDFDFlows, ...removedDFDFlows];
			setTimeout(() => {
				this.dfdFlows = this.dfdFlows.filter(f => !removedDFDFlowIdList.includes(f.id));
				this.dyingDFDFlowIds = new Set(
					[...this.dyingDFDFlowIds].filter(id => !removedDFDFlowIdList.includes(id))
				);
			}, 2500);
		} else {
			this.dfdFlows = newDFDFlows;
		}




		if (this.dfdDrillPath.length > 0) {
			const byId = new Map(this.dfdNodes.map((n) => [n.id, n]));
			let valid = 0;
			for (const pid of this.dfdDrillPath) {
				if (byId.get(pid)?.type === 'process') valid++;
				else break;
			}
			if (valid !== this.dfdDrillPath.length) this.dfdDrillPath = this.dfdDrillPath.slice(0, valid);
		}

		this.clearSelection();
	}

	pushHistory(label?: string) {
		if (this._skipHistory) return;
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
		if (this.deferEdit(this.editableItemIds, () => this.undo())) return;

		const c = getCollab();
		if (c?.connected && c.collabUndo()) return;


		if (this.history.length === 0) return;
		this.future.push(this.snapshot());
		this.futureLabels.push(this.historyLabels.pop() ?? 'Undo');
		this.restore(this.history.pop()!);
	}

	redo() {
		if (this.deferEdit(this.editableItemIds, () => this.redo())) return;

		const c = getCollab();
		if (c?.connected && c.collabRedo()) return;


		if (this.future.length === 0) return;
		this.history.push(this.snapshot());
		this.historyLabels.push(this.futureLabels.pop() ?? 'Redo');
		this.restore(this.future.pop()!);
	}


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
		getCollab()?.registerNewItem(entity.id);
		this.selectedNodeIds = [entity.id];

		this.newEntityIds = new Set([...this.newEntityIds, entity.id]);
		setTimeout(() => {
			this.newEntityIds = new Set([...this.newEntityIds].filter(id => id !== entity.id));
		}, 600);
		getCollab()?.pushEntityChange(entity);
		return entity;
	}

	updateEntity(id: string, updates: Partial<Pick<Entity, 'name' | 'isWeak' | 'color' | 'isLocked' | 'fontSize' | 'bold' | 'italic'>>) {
		if (this.deferEdit([id], () => this.updateEntity(id, updates))) return;
		const entity = this.entities.find((e) => e.id === id);
		if (!entity) return;
		this.pushHistory();
		if (updates.name !== undefined) entity.name = updates.name;
		if (updates.isWeak !== undefined) entity.isWeak = updates.isWeak;
		if (updates.color !== undefined) entity.color = updates.color;
		if (updates.isLocked !== undefined) entity.isLocked = updates.isLocked;
		if (updates.fontSize !== undefined) entity.fontSize = updates.fontSize;
		if (updates.bold !== undefined) entity.bold = updates.bold;
		if (updates.italic !== undefined) entity.italic = updates.italic;
		getCollab()?.pushEntityChange(entity);
	}

	removeEntity(id: string) {
		if (this.deferEdit(this.editDependencies([id]), () => this.removeEntity(id))) return;
		this.pushHistory();

		const dying = this.entities.find((e) => e.id === id);
		if (dying) {
			const box = this.estimateEntityBox(dying);
			this.dyingEntities = [...this.dyingEntities, { ...dying, _dyingRect: { x: dying.position.x, y: dying.position.y, width: box.w, height: box.h } }];
			setTimeout(() => { this.dyingEntities = this.dyingEntities.filter((e) => e.id !== id); }, 900);
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
		this.removeCommentsForTarget(id);
		for (const rel of removedRels) this.removeCommentsForTarget(rel.id);
	}

	removeEntities(ids: string[]) {
		if (this.deferEdit(this.editDependencies(ids), () => this.removeEntities(ids))) return;
		if (ids.length === 0) return;
		this.pushHistory();
		const idSet = new Set(ids);

		const dyingEnts = this.entities.filter((e) => idSet.has(e.id)).map((e) => {
			const box = this.estimateEntityBox(e);
			return { ...e, _dyingRect: { x: e.position.x, y: e.position.y, width: box.w, height: box.h } };
		});
		if (dyingEnts.length > 0) {
			this.dyingEntities = [...this.dyingEntities, ...dyingEnts];
			const dyingIds = new Set(dyingEnts.map((e) => e.id));
			setTimeout(() => { this.dyingEntities = this.dyingEntities.filter((e) => !dyingIds.has(e.id)); }, 900);
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
		if (this.deferEdit([id], () => this.toggleLockEntity(id))) return;
		const entity = this.entities.find((e) => e.id === id);
		if (!entity) return;
		this.pushHistory();
		entity.isLocked = !entity.isLocked;
		getCollab()?.pushEntityChange(entity);
	}


	private _moveThrottleTimer: ReturnType<typeof setTimeout> | null = null;
	private _movePendingIds = new Set<string>();
	private _moveMultiDrag = false;


	private _dragAwarenessTimer: ReturnType<typeof setTimeout> | null = null;
	private _dragAwarenessPending = new Map<string, { x: number; y: number }>();


	startMultiDrag() { this._moveMultiDrag = true; }

	moveEntity(id: string, position: Position) {
		if (this.viewOnly || (getCollab()?.connected && !getCollab()?.canEdit(id))) return;
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

			const c = getCollab();
			if (c?.connected) {

				this._dragAwarenessPending.set(id, { x: position.x, y: position.y });
				this._movePendingIds.add(id);
				if (!this._dragAwarenessTimer) {
					this._dragAwarenessTimer = setTimeout(() => {
						this._dragAwarenessTimer = null;
						if (this._dragAwarenessPending.size > 0) {
							const positions: Record<string, { x: number; y: number }> = {};
							for (const [k, v] of this._dragAwarenessPending) positions[k] = v;
							c.broadcastDragPositions(positions);
							this._dragAwarenessPending.clear();
						}
					}, 50);
				}
			}
		}
	}

	private _flushPendingMoves(c: NonNullable<ReturnType<typeof getCollab>>) {
		for (const pendingId of this._movePendingIds) {
			if (pendingId.startsWith('flow:')) {
				const n = this.flowNodes.find(nd => nd.id === pendingId.slice(5));
				if (n) c.pushFlowNodeChange(n);
			} else if (pendingId.startsWith('dfd:')) {
				const n = this.dfdNodes.find(nd => nd.id === pendingId.slice(4));
				if (n) c.pushDFDNodeChange(n);
			} else {
				const e = this.entities.find(ent => ent.id === pendingId);
				if (e) c.pushEntityChange(e);
			}
		}
		this._movePendingIds.clear();
	}


	flushMovePush() {
		this._moveMultiDrag = false;
		if (this._moveThrottleTimer) {
			clearTimeout(this._moveThrottleTimer);
			this._moveThrottleTimer = null;
		}

		if (this._dragAwarenessTimer) {
			clearTimeout(this._dragAwarenessTimer);
			this._dragAwarenessTimer = null;
		}
		this._dragAwarenessPending.clear();
		const c = getCollab();
		if (c?.connected) {

			c.broadcastDragStop();
		}

		if (c && this._movePendingIds.size > 0) {
			this._flushPendingMoves(c);
		}
	}


	addAttribute(entityId: string, attr: Omit<Attribute, 'id'>): Attribute | null {
		if (this.deferEdit([entityId], () => { this.addAttribute(entityId, attr); })) return null;
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return null;
		this.pushHistory();
		const attribute: Attribute = { id: generateId(), ...attr };
		entity.attributes.push(attribute);
		getCollab()?.pushEntityChange(entity);
		return attribute;
	}

	updateAttribute(entityId: string, attrId: string, updates: Partial<Omit<Attribute, 'id'>>) {
		if (this.deferEdit([entityId], () => this.updateAttribute(entityId, attrId, updates))) return;
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		const attr = entity.attributes.find((a) => a.id === attrId);
		if (!attr) return;
		this.pushHistory();
		Object.assign(attr, updates);
		getCollab()?.pushEntityChange(entity);
	}

	removeAttribute(entityId: string, attrId: string) {
		if (this.deferEdit([entityId], () => this.removeAttribute(entityId, attrId))) return;
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		this.pushHistory();
		entity.attributes = entity.attributes.filter((a) => a.id !== attrId);
		getCollab()?.pushEntityChange(entity);
	}


	moveAttributePosition(entityId: string, attrId: string, position: Position) {
		if (this.viewOnly || (getCollab()?.connected && !getCollab()?.canEdit(entityId))) return;
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		const attr = entity.attributes.find((a) => a.id === attrId);
		if (attr) {
			attr.position = position;
			getCollab()?.pushEntityChange(entity);
		}
	}

	moveAttribute(entityId: string, attrId: string, direction: -1 | 1) {
		if (this.deferEdit([entityId], () => this.moveAttribute(entityId, attrId, direction))) return;
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
		if (this.deferEdit([entityId], () => this.reorderAttribute(entityId, fromAttrId, toAttrId))) return;
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



	private emptySampleRow(entity: Entity): SampleRow {
		const row: SampleRow = {};
		for (const attr of storableAttributes(entity)) row[attr.name] = '';
		return row;
	}

	addSampleRow(entityId: string) {
		if (this.deferEdit([entityId], () => this.addSampleRow(entityId))) return;
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		this.pushHistory('เพิ่มแถวข้อมูล');
		entity.sampleRows = [...(entity.sampleRows ?? []), this.emptySampleRow(entity)];
		getCollab()?.pushEntityChange(entity);
	}

	updateSampleCell(entityId: string, rowIndex: number, column: string, value: SampleCell) {
		if (this.deferEdit([entityId], () => this.updateSampleCell(entityId, rowIndex, column, value))) return;
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		const rows = entity.sampleRows ?? [];
		if (rowIndex < 0 || rowIndex >= rows.length) return;
		this.pushHistory('แก้ข้อมูล');
		const next = rows.map((row, i) => (i === rowIndex ? { ...row, [column]: value } : row));
		entity.sampleRows = next;
		getCollab()?.pushEntityChange(entity);
	}

	removeSampleRow(entityId: string, rowIndex: number) {
		if (this.deferEdit([entityId], () => this.removeSampleRow(entityId, rowIndex))) return;
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		const rows = entity.sampleRows ?? [];
		if (rowIndex < 0 || rowIndex >= rows.length) return;
		this.pushHistory('ลบแถวข้อมูล');
		entity.sampleRows = rows.filter((_, i) => i !== rowIndex);
		getCollab()?.pushEntityChange(entity);
	}

	clearSampleRows(entityId: string) {
		if (this.deferEdit([entityId], () => this.clearSampleRows(entityId))) return;
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		if (!entity.sampleRows || entity.sampleRows.length === 0) return;
		this.pushHistory('ล้างข้อมูล');
		entity.sampleRows = [];
		getCollab()?.pushEntityChange(entity);
	}


	generateSampleData(entityId: string, count = 5) {
		if (this.deferEdit([entityId], () => this.generateSampleData(entityId, count))) return;
		const entity = this.entities.find((e) => e.id === entityId);
		if (!entity) return;
		const cols = storableAttributes(entity);
		if (cols.length === 0) return;
		const attrByName = new Map(entity.attributes.map((a) => [a.name.toLowerCase(), a]));
		const rows: SampleRow[] = [];
		for (let i = 1; i <= count; i++) {
			const row: SampleRow = {};
			for (const col of cols) {

				if (col.type === 'primary_key') {
					row[col.name] = '';
				} else {
					row[col.name] = sampleValue(col.name, attrByName.get(col.name.toLowerCase()), i);
				}
			}
			rows.push(row);
		}
		this.pushHistory('สร้างข้อมูลอัตโนมัติ');
		entity.sampleRows = rows;
		getCollab()?.pushEntityChange(entity);
	}


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
		getCollab()?.registerNewItem(rel.id);
		this.selectedEdgeId = rel.id;

		this.newRelationshipIds = new Set([...this.newRelationshipIds, rel.id]);
		setTimeout(() => {
			this.newRelationshipIds = new Set([...this.newRelationshipIds].filter(id => id !== rel.id));
		}, 3500);
		getCollab()?.pushRelationshipChange(rel);
		return rel;
	}

	updateRelationship(id: string, updates: Partial<Pick<Relationship, 'name' | 'cardinalities' | 'isIdentifying' | 'description' | 'labelOffset' | 'dataFlowDirection' | 'waypoints' | 'fromWaypoints' | 'toWaypoints' | 'diamondPosition' | 'fromAnchor' | 'toAnchor' | 'fromCardinalityOffset' | 'toCardinalityOffset'>>) {
		if (this.deferEdit([id], () => this.updateRelationship(id, updates))) return;
		const rel = this.relationships.find((r) => r.id === id);
		if (!rel) return;
		this.pushHistory();
		if (updates.name !== undefined) rel.name = updates.name;
		if (updates.cardinalities !== undefined) rel.cardinalities = updates.cardinalities;
		if (updates.isIdentifying !== undefined) rel.isIdentifying = updates.isIdentifying;
		if (updates.description !== undefined) rel.description = updates.description;
		if (updates.labelOffset !== undefined) rel.labelOffset = updates.labelOffset;
		if (updates.fromCardinalityOffset !== undefined) rel.fromCardinalityOffset = updates.fromCardinalityOffset;
		if (updates.toCardinalityOffset !== undefined) rel.toCardinalityOffset = updates.toCardinalityOffset;
		if (updates.fromAnchor !== undefined) rel.fromAnchor = updates.fromAnchor;
		if (updates.toAnchor !== undefined) rel.toAnchor = updates.toAnchor;
		if (updates.diamondPosition !== undefined) rel.diamondPosition = updates.diamondPosition;
		if (updates.waypoints !== undefined) rel.waypoints = updates.waypoints;
		if (updates.fromWaypoints !== undefined) rel.fromWaypoints = updates.fromWaypoints;
		if (updates.toWaypoints !== undefined) rel.toWaypoints = updates.toWaypoints;
		if (updates.dataFlowDirection !== undefined) rel.dataFlowDirection = updates.dataFlowDirection;
		getCollab()?.pushRelationshipChange(rel);
	}

	removeRelationship(id: string) {
		if (this.deferEdit([id], () => this.removeRelationship(id))) return;
		this.pushHistory();
		if (this.selectedEdgeId === id) this.selectedEdgeId = null;

		this.dyingRelationshipIds = new Set([...this.dyingRelationshipIds, id]);
		setTimeout(() => {

			if (!this.dyingRelationshipIds.has(id)) return;
			this.relationships = this.relationships.filter((r) => r.id !== id);
			this.dyingRelationshipIds = new Set([...this.dyingRelationshipIds].filter(rid => rid !== id));
		}, 2500);
		getCollab()?.pushRelationshipRemove(id);
		this.removeCommentsForTarget(id);
	}


	setDiagramFont(font: string) {
		if (this.deferEdit(this.editableItemIds, () => this.setDiagramFont(font))) return;
		this.diagramFont = font;
		getCollab()?.pushMeta('diagramFont', font);
	}

	setDiagramFontSize(size: number) {
		if (this.deferEdit(this.editableItemIds, () => this.setDiagramFontSize(size))) return;
		this.diagramFontSize = Math.max(8, Math.min(48, Math.round(size)));
		getCollab()?.pushMeta('diagramFontSize', String(this.diagramFontSize));


		for (const e of this.entities) {
			if (e.fontSize !== undefined) {
				e.fontSize = undefined;
				getCollab()?.pushEntityChange(e);
			}
		}
		for (const n of this.flowNodes) {
			if (n.fontSize !== undefined) {
				n.fontSize = undefined;
				getCollab()?.pushFlowNodeChange(n);
			}
		}
	}


	addCustomFont(font: CustomFont) {
		if (this.customFonts.some(f => f.label === font.label)) return;
		this.customFonts = [...this.customFonts, font];
		getCollab()?.pushMeta('customFonts', JSON.stringify(this.customFonts));
	}

	removeCustomFont(label: string) {
		this.customFonts = this.customFonts.filter(f => f.label !== label);

		if (this.diagramFont.includes(label)) {
			this.setDiagramFont("'Kanit', sans-serif");
		}
		getCollab()?.pushMeta('customFonts', JSON.stringify(this.customFonts));
	}


	setNotation(notation: NotationStyle, isRemote = false) {

		if (!isRemote) {
			const c = getCollab();
			if (c && c.connected) {
				c.broadcastNotation(notation);
			}
		}


		this.notationRelPhase = 'hidden';
		this.notationTransitioning = true;
		this.notationMorphing = true;


		setTimeout(() => {
			this.notation = notation;
			if (!isRemote) getCollab()?.pushMeta('notation', notation);
			this.notationTransitioning = false;
			this.notationAppearing = true;


			setTimeout(() => {
				this.notationOvalsAppearing = true;
			}, 450);


			setTimeout(() => {
				this.notationRelPhase = 'draw';
			}, 650);


			setTimeout(() => {
				this.notationRelPhase = null;
				this.notationAppearing = false;
				this.notationMorphing = false;
				this.notationOvalsAppearing = false;
			}, 1500);
		}, 500);
	}


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


	saveBookmark(slot: number) {
		if (slot < 1 || slot > 9) return;
		this.bookmarks.set(slot, {
			panX: this.panX,
			panY: this.panY,
			zoom: this.zoom
		});
	}


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
					const cw = node.width || 28;
					const ch = node.height || 28;
					expand(cx - cw / 2, cy - ch / 2, cw, ch);
				} else {
					expand(cx - 70, cy - 30, 140, 60);
				}
			}
		} else if (this.diagramType === 'context') {

			for (const node of this.dfdVisibleNodes) {
				const { x: cx, y: cy } = node.position;
				if (node.type === 'external-entity') {
					expand(cx - 60, cy - 25, 120, 50);
				} else if (node.type === 'data-store') {
					expand(cx - 70, cy - 20, 140, 40);
				} else {

					const h = (node.processNumber ? 28 : 0) + 50;
					expand(cx - 70, cy - h / 2, 140, h);
				}
			}
		}


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
		const scale = (entity.fontSize ?? this.diagramFontSize) / 14;
		return { w: w * scale, h: h * scale };
	}


	private estimateEntitySpace(entity: Entity): { w: number; h: number } {
		const box = this.estimateEntityBox(entity);
		if (this.notation === 'chen' && entity.attributes.length > 0) {

			const extra = 120;
			return { w: box.w + extra, h: box.h + extra };
		}
		return box;
	}


	animating = $state(false);
	private _animationFrameId = 0;
	private _pendingLayouts = 0;
	async waitForEdits() {
		while (this.animating || this._pendingLayouts > 0 || this.physicsMode) await new Promise(resolve => setTimeout(resolve, 50));
	}
	private _safetyTimer: ReturnType<typeof setTimeout> | null = null;

	cancelAnimation() {
		if (this._animationFrameId) {
			cancelAnimationFrame(this._animationFrameId);
			this._animationFrameId = 0;
		}
		if (this._safetyTimer) {
			clearTimeout(this._safetyTimer);
			this._safetyTimer = null;
		}
		this.animating = false;
	}


	private computeLayoutPositions(): { positions: Map<string, Position>; timedOut: boolean } | null {
		const n = this.entities.length;
		if (n === 0) return null;

		if (n === 1) {
			const positions = new Map<string, Position>();
			positions.set(this.entities[0].id, { x: 80, y: 80 });
			return { positions, timedOut: false };
		}


		const sizes = new Map<string, { w: number; h: number }>();
		const spaces = new Map<string, { w: number; h: number }>();
		for (const e of this.entities) {
			sizes.set(e.id, this.estimateEntityBox(e));
			spaces.set(e.id, this.estimateEntitySpace(e));
		}


		const adj = new Map<string, Set<string>>();
		for (const e of this.entities) {
			adj.set(e.id, new Set());
		}
		for (const rel of this.relationships) {
			adj.get(rel.entityIds[0])?.add(rel.entityIds[1]);
			adj.get(rel.entityIds[1])?.add(rel.entityIds[0]);
		}


		const relLabelBoxes: { relId: string; w: number; h: number }[] = [];
		for (const rel of this.relationships) {
			const isChen = this.notation === 'chen';
			const labelW = isChen ? Math.max(100, rel.name.length * 8 + 40) : rel.name.length * 8 + 30;
			const labelH = isChen ? 55 : 30;
			relLabelBoxes.push({ relId: rel.id, w: labelW, h: labelH });
		}


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

		const positions = new Map<string, { x: number; y: number }>();

		const isChen = this.notation === 'chen';
		const GAP_X = (isChen ? 100 : 100) + Math.max(0, n - 8) * 15;
		const GAP_Y = (isChen ? 120 : 150) + Math.max(0, n - 8) * 10;
		let componentOffsetY = 0;

		for (const component of components) {

			const degrees = component.map((id) => ({ id, deg: adj.get(id)?.size ?? 0 }));
			degrees.sort((a, b) => b.deg - a.deg || Math.random() - 0.5);
			const rootId = degrees[0].id;


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


			for (const id of component) {
				if (!layerOf.has(id)) {
					if (!layers[0]) layers[0] = [];
					layers[0].push(id);
				}
			}


			for (let i = 0; i < layers.length; i++) {
				layers[i].sort((a, b) => (adj.get(b)?.size ?? 0) - (adj.get(a)?.size ?? 0) || Math.random() - 0.5);

				const sorted = [...layers[i]];
				const reordered: string[] = new Array(sorted.length);
				let left = Math.floor((sorted.length - 1) / 2);
				let right = left + 1;
				for (let j = 0; j < sorted.length; j++) {
					if (j % 2 === 0) {
						reordered[left--] = sorted[j];
					} else {
						reordered[right++] = sorted[j];
					}
				}
				layers[i] = reordered;
			}


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


				let x = 0;
				for (const id of layer) {
					const sp = spaces.get(id)!;
					const box = sizes.get(id)!;

					positions.set(id, {
						x: x + (sp.w - box.w) / 2,
						y: layerY + (maxH - box.h) / 2
					});
					x += sp.w + GAP_X;
				}

				layerY += maxH + GAP_Y;
			}


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


		const entityIds = this.entities.map((e) => e.id);
		const PAD = isChen ? 50 : 30;

		const layoutStartTime = Date.now();
		const LAYOUT_TIMEOUT_MS = 5000;
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


		resolveOverlaps(entityIds, positions, spaces, PAD, 60);


		function lineIntersectsRect(
			ax: number, ay: number, bx: number, by: number,
			rl: number, rt: number, rr: number, rb: number
		): boolean {


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


		const LABEL_PAD = 30;
		const LINE_PAD = 20;
		for (let iteration = 0; iteration < 8; iteration++) {
			if (Date.now() - layoutStartTime > LAYOUT_TIMEOUT_MS) { timedOut = true; break; }
			let anyMoved = false;


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


			for (let pass = 0; pass < 10; pass++) {
				if (Date.now() - layoutStartTime > LAYOUT_TIMEOUT_MS) { timedOut = true; break; }
				let moved = false;
				for (const rel of this.relationships) {
					const posFrom = positions.get(rel.entityIds[0]);
					const posTo = positions.get(rel.entityIds[1]);
					if (!posFrom || !posTo) continue;
					const sFrom = sizes.get(rel.entityIds[0])!;
					const sTo = sizes.get(rel.entityIds[1])!;


					const ax = posFrom.x + sFrom.w / 2;
					const ay = posFrom.y + sFrom.h / 2;
					const bx = posTo.x + sTo.w / 2;
					const by = posTo.y + sTo.h / 2;

					for (const e of this.entities) {
						if (e.id === rel.entityIds[0] || e.id === rel.entityIds[1]) continue;
						const pos = positions.get(e.id)!;
						const box = sizes.get(e.id)!;


						const rl = pos.x - LINE_PAD;
						const rt = pos.y - LINE_PAD;
						const rr = pos.x + box.w + LINE_PAD;
						const rb = pos.y + box.h + LINE_PAD;

						if (lineIntersectsRect(ax, ay, bx, by, rl, rt, rr, rb)) {
							moved = true;
							anyMoved = true;

							const lineDx = bx - ax;
							const lineDy = by - ay;
							const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
							if (lineLen < 1) continue;

							const nx = -lineDy / lineLen;
							const ny = lineDx / lineLen;

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


			resolveOverlaps(entityIds, positions, spaces, PAD, 20);

			if (!anyMoved) break;
		}


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

	private _layoutGen = 0;


	animateLayout(duration = 300) {
		if (this.deferEdit(this.editableItemIds, () => this.animateLayout(duration))) return;
		if (this.diagramType === 'flowchart') { this.flowAutoLayout(duration); return; }
		if (this.diagramType === 'context') { this.dfdAutoLayout(); return; }

		this.cancelAnimation();
		const gen = ++this._layoutGen;


		const entities = $state.snapshot(this.entities);
		const relationships = $state.snapshot(this.relationships);
		const notation = this.notation;
		const inputState = JSON.stringify([entities, relationships, notation]);
		const estimateBox = (e: Entity) => this.estimateEntityBox(e);


		this._pendingLayouts++;
		getElk()
			.then(m => m.computeELKLayout(entities, relationships, notation, estimateBox, Math.floor(Math.random() * 2147483646) + 1))
			.then(positions => {
				if (gen !== this._layoutGen || inputState !== JSON.stringify([this.entities, this.relationships, this.notation])) return;
				if (positions && positions.size > 0) {
					this._startAnimation(positions, duration);
				} else {
					this._startBFSAnimation(duration);
				}
			})
			.catch(() => {
				if (gen !== this._layoutGen || inputState !== JSON.stringify([this.entities, this.relationships, this.notation])) return;
				this._startBFSAnimation(duration);
			}).finally(() => { this._pendingLayouts--; });
	}

	private _startBFSAnimation(duration: number) {
		const result = this.computeLayoutPositions();
		if (!result) return;
		this._startAnimation(result.positions, duration);
	}


	applyRemoteLayout(targetPositions: Map<string, Position>) {
		this._startAnimation(targetPositions, 0, true);
	}

	private _startAnimation(targetPositions: Map<string, Position>, _duration: number, isRemote = false) {
		this.cancelAnimation();
		if (!isRemote) for (const entity of this.entities) if (entity.isLocked) targetPositions.set(entity.id, { ...entity.position });


		const oldPositions = new Map<string, Position>();
		for (const e of this.entities) {
			oldPositions.set(e.id, { ...e.position });
		}

		this.pushHistory('Auto layout');
        const erLayout = targetPositions as import('$lib/utils/elk-layout').ERLayoutPositions;
        if (!isRemote) for (const relationship of this.relationships) {
            delete relationship.waypoints; delete relationship.fromWaypoints; delete relationship.toWaypoints;
            delete relationship.fromAnchor; delete relationship.toAnchor;
            delete relationship.labelOffset;
            if (erLayout.diamonds?.has(relationship.id)) relationship.diamondPosition = erLayout.diamonds.get(relationship.id);
            else delete relationship.diamondPosition;
            getCollab()?.pushRelationshipChange(relationship);
        }



		if (this.notation === 'chen') {
			for (const entity of this.entities) {
				if (entity.isLocked) continue;
				for (const attr of entity.attributes) {
					if (erLayout.attributes?.has(attr.id)) attr.position = erLayout.attributes.get(attr.id);
					else delete attr.position;
				}
			}
		}


		if (!isRemote) {
			const c = getCollab();
			if (c && c.connected) {
				const positions: Record<string, { x: number; y: number }> = {};
				for (const [id, pos] of targetPositions) {
					positions[id] = { x: pos.x, y: pos.y };
				}
				c.broadcastLayout(positions);
			}
		}


		const STAGGER_MAX = 200;
		const ENTITY_DUR = 600;
		const TOTAL_DUR = STAGGER_MAX + ENTITY_DUR;


		const elasticOut = (t: number): number => {
			if (t === 0 || t === 1) return t;
			return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
		};


		let cx = 0, cy = 0, count = 0;
		for (const pos of targetPositions.values()) {
			cx += pos.x; cy += pos.y; count++;
		}
		if (count > 0) { cx /= count; cy /= count; }


		const delays = new Map<string, number>();
		let maxDist = 0;
		for (const [id, pos] of targetPositions) {
			const dist = Math.hypot(pos.x - cx, pos.y - cy);
			if (dist > maxDist) maxDist = dist;
			delays.set(id, dist);
		}

		for (const [id, dist] of delays) {
			delays.set(id, maxDist > 0 ? (dist / maxDist) * STAGGER_MAX : 0);
		}

		this.animating = true;


		this.notationRelPhase = 'hidden';


		this._safetyTimer = setTimeout(() => {
			this.animating = false;
			this.notationRelPhase = null;
			this._animationFrameId = 0;
			this._safetyTimer = null;
		}, TOTAL_DUR + 500);

		const startTime = performance.now();

		const animate = (now: number) => {
			if (!isRemote && getCollab()?.connected && [...targetPositions.keys()].some(id => !getCollab()?.canEdit(id))) { this.cancelAnimation(); return; }
			try {
				const elapsed = now - startTime;

				let allDone = true;
				for (const e of this.entities) {
					const from = oldPositions.get(e.id);
					const to = targetPositions.get(e.id);
					if (!from || !to) continue;

					const delay = delays.get(e.id) ?? 0;
					const localT = Math.min(Math.max((elapsed - delay) / ENTITY_DUR, 0), 1);
					const t = elasticOut(localT);

					e.position = {
						x: from.x + (to.x - from.x) * t,
						y: from.y + (to.y - from.y) * t
					};

					if (localT < 1) allDone = false;
				}

				if (!allDone) {
					this._animationFrameId = requestAnimationFrame(animate);
				} else {

					for (const e of this.entities) {
						const to = targetPositions.get(e.id);
						if (to) {
							e.position = { x: Math.round(to.x), y: Math.round(to.y) };
						}
					}

					if (this._safetyTimer) { clearTimeout(this._safetyTimer); this._safetyTimer = null; }
					this._animationFrameId = 0;
					this.animating = false;


					this.notationRelPhase = 'draw';
					setTimeout(() => { this.notationRelPhase = null; }, 600);


					this.smoothTransition = true;
					if (this.canvasWidth > 0 && this.canvasHeight > 0) {
						this.fitToContent(this.canvasWidth, this.canvasHeight);
					} else {
						this.panX = 0;
						this.panY = 0;
						this.zoom = 1;
					}
					setTimeout(() => { this.smoothTransition = false; }, 300);


					if (!isRemote) {
						const c = getCollab();
						if (c) {
							for (const e of this.entities) c.pushEntityChange(e);
						}
					}
				}
			} catch {
				if (this._safetyTimer) { clearTimeout(this._safetyTimer); this._safetyTimer = null; }
				this._animationFrameId = 0;
				this.animating = false;
				this.notationRelPhase = null;
			}
		};

		this._animationFrameId = requestAnimationFrame(animate);
	}


	autoLayout() {
		this.animateLayout();
	}


	selectEntity(id: string | null) {
		this.selectedFlowEdgeIds = [];
		this.selectedNodeIds = id ? [id] : [];
		this.selectedEdgeId = null;
	}

	selectEntities(ids: string[]) {
		this.selectedFlowEdgeIds = [];
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
		this.selectedFlowEdgeIds = [];
		this.selectedEdgeId = id;
		this.selectedNodeIds = [];
	}

	clearSelection() {
		this.selectedFlowEdgeIds = [];
		this.selectedNodeIds = [];
		this.selectedEdgeId = null;
	}

	selectAll() {
		if (this.diagramType === 'flowchart') {
			this.selectedNodeIds = this.flowNodes.map((n) => n.id);
		} else if (this.diagramType === 'context') {
			this.selectedNodeIds = this.dfdNodes.map((n) => n.id);
		} else {
			this.selectedNodeIds = this.entities.map((e) => e.id);
		}
		this.selectedEdgeId = null;
	}

	copySelected() {
		if (this.selectedNodeIds.length === 0) return;
		if (this.diagramType === 'flowchart') {
			const nodes = this.flowNodes.filter((n) => this.selectedNodeIdSet.has(n.id));
			this.clipboard = JSON.stringify({ type: 'flowchart', nodes });
		} else if (this.diagramType === 'context') {
			const nodes = this.dfdNodes.filter((n) => this.selectedNodeIdSet.has(n.id));
			this.clipboard = JSON.stringify({ type: 'context', nodes });
		} else {
			const ents = this.entities.filter((e) => this.selectedNodeIdSet.has(e.id));
			this.clipboard = JSON.stringify({ type: 'er', nodes: ents });
		}
	}

	paste() {
		if (!this.clipboard) return;
		try {
			const data = JSON.parse(this.clipboard);
			this.pushHistory('Paste');
			const newIds: string[] = [];

			if (data.type === 'context' && this.diagramType === 'context') {
				for (const n of data.nodes as DFDNode[]) {
					const newId = generateId();
					const node: DFDNode = {
						id: newId, name: n.name , type: n.type,
						position: { x: n.position.x + 30, y: n.position.y + 30 },
						processNumber: n.processNumber, storeNumber: n.storeNumber, color: n.color
					};
					this.dfdNodes.push(node);
		getCollab()?.registerNewItem(node.id);
					getCollab()?.pushDFDNodeChange(node);
					newIds.push(newId);
				}
			} else if (data.type === 'flowchart' && this.diagramType === 'flowchart') {
				for (const n of data.nodes as FlowNode[]) {
					const newId = generateId();
					const node: FlowNode = {
						id: newId, name: n.name , type: n.type,
						position: { x: n.position.x + 30, y: n.position.y + 30 },
						color: n.color
					};
					this.flowNodes.push(node);
		getCollab()?.registerNewItem(node.id);
					getCollab()?.pushFlowNodeChange(node);
					newIds.push(newId);
				}
			} else if (data.type === 'er' || Array.isArray(data.nodes || data)) {

				const ents = (data.nodes || data) as Entity[];
				for (const e of ents) {
					const newId = generateId();
					const entity: Entity = {
						id: newId, name: e.name ,
						attributes: e.attributes.map((a) => ({ ...a, id: generateId() })),
						position: { x: e.position.x + 30, y: e.position.y + 30 },
						isWeak: e.isWeak, color: e.color
					};
					this.entities.push(entity);
		getCollab()?.registerNewItem(entity.id);
					getCollab()?.pushEntityChange(entity);
					newIds.push(newId);
				}
			}

			this.selectedNodeIds = newIds;
		} catch { /* invalid clipboard */ }
	}

	toggleGrid() {
		this.showGrid = !this.showGrid;
	}

	toggleSketchMode() {
		this.sketchMode = !this.sketchMode;
	}

	toggleSmartRouting() {
		this.smartRouting = !this.smartRouting;
	}

	toggleDataFlow() {
		this.showDataFlow = !this.showDataFlow;
		const c = getCollab();
		if (c?.connected) c.broadcastDataFlow(this.showDataFlow);
	}

	restoreHistoryEntry(index: number) {
		if (this.deferEdit(this.editableItemIds, () => this.restoreHistoryEntry(index))) return;
		if (index < 0 || index >= this.history.length) return;
		this.pushHistory('Restore');
		this.restore(this.history[index]);
	}


	previewHistoryEntry(index: number) {
		if (index < 0 || index >= this.history.length) return;
		if (!this.timelinePreviewActive) {

			this._previewSavedState = this.snapshot();
			this.timelinePreviewActive = true;
		}
		this.restore(this.history[index]);
	}


	exitPreview(commit: boolean) {
		if (!this.timelinePreviewActive) return;
		if (!commit && this._previewSavedState) {

			this.restore(this._previewSavedState);
		}
		if (commit) {
			this.pushHistory('Timeline restore');

			getCollab()?.pushFullState();
		}
		this._previewSavedState = null;
		this.timelinePreviewActive = false;
	}


	previewData(data: import('$lib/types/session').DiagramData) {
		if (!this.timelinePreviewActive) {
			this._previewSavedState = this.snapshot();
			this.timelinePreviewActive = true;
		}
		this.restore(JSON.stringify({
			entities: data.entities ?? [],
			relationships: data.relationships ?? [],
			notes: data.notes ?? [],
			flowNodes: data.flowNodes ?? [],
			flowEdges: data.flowEdges ?? [],
			dfdNodes: data.dfdNodes ?? [],
			dfdFlows: data.dfdFlows ?? []
		}));
	}


	loadData(data: import('$lib/types/session').DiagramData) {
		if (this.deferEdit(this.editableItemIds, () => this.loadData(data))) return;
		this.pushHistory('Cloud restore');
		this.entities = data.entities ?? [];
		this.relationships = data.relationships ?? [];
		this.notes = data.notes ?? [];
		this.comments = data.comments ?? [];
		this.notation = data.notation ?? 'crows-foot';
		this.diagramFont = data.diagramFont ?? "'Kanit', sans-serif";
		this.diagramFontSize = data.diagramFontSize ?? 14;
		this.flowNodes = data.flowNodes ?? [];
		this.flowEdges = data.flowEdges ?? [];
		for (const n of this.flowNodes) autoSizeFlowNode(n, this.diagramFontSize);
		this.dfdNodes = data.dfdNodes ?? [];
		this.dfdFlows = data.dfdFlows ?? [];
		if (data.panX !== undefined) this.panX = data.panX;
		if (data.panY !== undefined) this.panY = data.panY;
		if (data.zoom !== undefined) this.zoom = data.zoom;
		getCollab()?.pushFullState();
	}


	loadFlowchartData(nodes: FlowNode[], edges: FlowEdge[], mode: 'replace' | 'merge' = 'replace', keepPositions = false) {
		if (this.deferEdit(this.editableItemIds, () => this.loadFlowchartData(nodes, edges, mode, keepPositions))) return;
		this.pushHistory('Import flowchart');


		for (const n of nodes) autoSizeFlowNode(n, this.diagramFontSize);
		if (mode === 'replace') {
			this.flowNodes = nodes;
			this.flowEdges = edges;
		} else {
			this.flowNodes = [...this.flowNodes, ...nodes];
			this.flowEdges = [...this.flowEdges, ...edges];
		}
		const c = getCollab();
		if (c) {
			for (const n of this.flowNodes) c.pushFlowNodeChange(n);
			for (const e of this.flowEdges) c.pushFlowEdgeChange(e);
		}
		if (!keepPositions) this.flowAutoLayout();
	}

	applyTranslation(mapping: {
		entities: Record<string, string>;
		attributes: Record<string, string>;
		relationships: Record<string, string>;
	}) {
		if (this.deferEdit(this.editableItemIds, () => this.applyTranslation(mapping))) return;
		this.pushHistory();

		if (this.diagramType === 'flowchart') {

			for (const node of this.flowNodes) {
				if (mapping.entities[node.name]) {
					node.name = mapping.entities[node.name];
				}
			}
			for (const edge of this.flowEdges) {
				if (edge.label && mapping.attributes[edge.label]) {
					edge.label = mapping.attributes[edge.label];
				}
			}

			const c = getCollab();
			if (c) {
				for (const n of this.flowNodes) c.pushFlowNodeChange(n);
				for (const e of this.flowEdges) c.pushFlowEdgeChange(e);
			}
		} else if (this.diagramType === 'context') {

			for (const node of this.dfdNodes) {
				if (mapping.entities[node.name]) {
					node.name = mapping.entities[node.name];
				}
			}
			for (const flow of this.dfdFlows) {
				if (flow.label && mapping.attributes[flow.label]) {
					flow.label = mapping.attributes[flow.label];
				}
			}

			const c = getCollab();
			if (c) {
				for (const n of this.dfdNodes) c.pushDFDNodeChange(n);
				for (const f of this.dfdFlows) c.pushDFDFlowChange(f);
			}
		} else {

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

			const c = getCollab();
			if (c) {
				for (const e of this.entities) c.pushEntityChange(e);
				for (const r of this.relationships) c.pushRelationshipChange(r);
			}
		}
	}


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
		getCollab()?.registerNewItem(note.id);
		getCollab()?.pushNoteChange(note);
		return note;
	}

	updateNote(id: string, text: string) {
		if (this.deferEdit([id], () => this.updateNote(id, text))) return;
		const note = this.notes.find((n) => n.id === id);
		if (!note) return;
		this.pushHistory('Edit note');
		note.text = text;
		getCollab()?.pushNoteChange(note);
	}

	removeNote(id: string) {
		if (this.deferEdit([id], () => this.removeNote(id))) return;
		this.pushHistory('Remove note');
		this.notes = this.notes.filter((n) => n.id !== id);
		getCollab()?.pushNoteRemove(id);
	}

	moveNote(id: string, position: Position) {
		if (this.viewOnly || (getCollab()?.connected && !getCollab()?.canEdit(id))) return;
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




	commentCountByTarget = $derived.by(() => {
		const map = new Map<string, number>();
		for (const c of this.comments) {
			if (c.resolved) continue;
			map.set(c.targetId, (map.get(c.targetId) ?? 0) + 1);
		}
		return map;
	});

	commentsForTarget(targetId: string): Comment[] {
		return this.comments
			.filter((c) => c.targetId === targetId)
			.sort((a, b) => a.createdAt - b.createdAt);
	}

	addComment(
		targetId: string,
		targetType: CommentTargetType,
		text: string,
		authorName: string,
		parentId: string | null = null,
		createdAt = Date.now()
	): Comment {
		this.pushHistory('Add comment');
		const comment: Comment = {
			id: generateId(),
			targetId,
			targetType,
			text,
			authorName: authorName || 'Anonymous',
			createdAt,
			resolved: false,
			parentId
		};
		this.comments.push(comment);
		getCollab()?.pushCommentChange(comment);
		return comment;
	}

	updateComment(id: string, text: string) {
		const comment = this.comments.find((c) => c.id === id);
		if (!comment) return;
		this.pushHistory('Edit comment');
		comment.text = text;
		getCollab()?.pushCommentChange(comment);
	}

	toggleCommentResolved(id: string) {
		const comment = this.comments.find((c) => c.id === id);
		if (!comment) return;
		this.pushHistory('Resolve comment');
		comment.resolved = !comment.resolved;
		getCollab()?.pushCommentChange(comment);
	}

	removeComment(id: string) {
		this.pushHistory('Remove comment');

		const removeIds = new Set<string>([id]);
		for (const c of this.comments) {
			if (c.parentId === id) removeIds.add(c.id);
		}
		this.comments = this.comments.filter((c) => !removeIds.has(c.id));
		const collab = getCollab();
		if (collab) for (const rid of removeIds) collab.pushCommentRemove(rid);
	}


	removeCommentsForTarget(targetId: string) {
		const removed = this.comments.filter((c) => c.targetId === targetId);
		if (removed.length === 0) return;
		this.comments = this.comments.filter((c) => c.targetId !== targetId);
		const collab = getCollab();
		if (collab) for (const c of removed) collab.pushCommentRemove(c.id);
	}


	pruneOrphanComments() {
		const liveIds = new Set<string>([
			...this.entities.map((e) => e.id),
			...this.relationships.map((r) => r.id),
			...this.flowNodes.map((n) => n.id),
			...this.flowEdges.map((e) => e.id),
			...this.dfdNodes.map((n) => n.id),
			...this.dfdFlows.map((f) => f.id)
		]);
		const orphans = this.comments.filter((c) => !liveIds.has(c.targetId));
		if (orphans.length === 0) return;
		const orphanIds = new Set(orphans.map((c) => c.id));
		this.comments = this.comments.filter((c) => !orphanIds.has(c.id));
		const collab = getCollab();
		if (collab) for (const oid of orphanIds) collab.pushCommentRemove(oid);
	}



	addFlowNode(name: string, type: FlowNodeType = 'process', position?: Position): FlowNode {
		this.pushHistory('Add flow node');
		const node: FlowNode = {
			id: generateId(),
			name,
			type,
			position: position ?? this.getNextPosition(),

			...(type === 'connector' ? { width: 28, height: 28 } : {})
		};
		autoSizeFlowNode(node, this.diagramFontSize);
		this.flowNodes.push(node);
		getCollab()?.registerNewItem(node.id);
		this.selectedNodeIds = [node.id];
		this.newEntityIds = new Set([...this.newEntityIds, node.id]);
		setTimeout(() => { this.newEntityIds = new Set([...this.newEntityIds].filter(id => id !== node.id)); }, 600);
		getCollab()?.pushFlowNodeChange(node);
		return node;
	}

	updateFlowNode(id: string, updates: Partial<Pick<FlowNode, 'name' | 'type' | 'color' | 'borderRadius' | 'width' | 'height' | 'fontSize' | 'bold' | 'italic'>>) {
		if (this.deferEdit([id], () => this.updateFlowNode(id, updates))) return;
		const node = this.flowNodes.find((n) => n.id === id);
		if (!node) return;
		this.pushHistory();
		if (updates.name !== undefined) {
			node.name = updates.name;
			delete node.wordOffsets;
		}
		if (updates.type !== undefined) node.type = updates.type;
		if (updates.color !== undefined) node.color = updates.color;
		if (updates.borderRadius !== undefined) node.borderRadius = updates.borderRadius;


		const manualResize = updates.width !== undefined || updates.height !== undefined;
		if (updates.width !== undefined) node.width = updates.width;
		if (updates.height !== undefined) node.height = updates.height;
		if (manualResize) node.manualSize = true;
		if (updates.fontSize !== undefined) node.fontSize = updates.fontSize;
		if (updates.bold !== undefined) node.bold = updates.bold;
		if (updates.italic !== undefined) node.italic = updates.italic;


		if (!manualResize && (updates.name !== undefined || updates.type !== undefined || updates.fontSize !== undefined || updates.bold !== undefined || updates.italic !== undefined)) {
			autoSizeFlowNode(node, this.diagramFontSize);
		}
		getCollab()?.pushFlowNodeChange(node);
	}

	removeFlowNode(id: string) {
		if (this.deferEdit(this.editDependencies([id]), () => this.removeFlowNode(id))) return;
		this.pushHistory('Remove flow node');

		const dying = this.flowNodes.find((n) => n.id === id);
		if (dying) {
			this.dyingFlowNodes = [...this.dyingFlowNodes, { ...dying }];
			setTimeout(() => { this.dyingFlowNodes = this.dyingFlowNodes.filter((n) => n.id !== id); }, 700);
		}
		const c = getCollab();

		const dyingEdgeIds = this.flowEdges.filter(e => e.fromNodeId === id || e.toNodeId === id).map(e => e.id);
		if (dyingEdgeIds.length > 0) {
			this.dyingFlowEdgeIds = new Set([...this.dyingFlowEdgeIds, ...dyingEdgeIds]);

			setTimeout(() => {
				this.flowEdges = this.flowEdges.filter(e => !dyingEdgeIds.includes(e.id));
				this.dyingFlowEdgeIds = new Set([...this.dyingFlowEdgeIds].filter(eid => !dyingEdgeIds.includes(eid)));
				this.flowNodes = this.flowNodes.filter((n) => n.id !== id);
			}, 500);
		} else {
			this.flowNodes = this.flowNodes.filter((n) => n.id !== id);
		}
		const connectedEdgeIds: string[] = [];
		for (const e of this.flowEdges) {
			if (e.fromNodeId === id || e.toNodeId === id) { c?.pushFlowEdgeRemove(e.id); connectedEdgeIds.push(e.id); }
		}
		this.selectedNodeIds = this.selectedNodeIds.filter((nid) => nid !== id);
		c?.pushFlowNodeRemove(id);
		this.removeCommentsForTarget(id);
		for (const eid of connectedEdgeIds) this.removeCommentsForTarget(eid);
	}

	moveFlowNode(id: string, position: Position) {
		if (this.viewOnly || (getCollab()?.connected && !getCollab()?.canEdit(id))) return;
		const node = this.flowNodes.find((n) => n.id === id);
		if (node) {
			if (this.showGrid) {
				position = { x: Math.round(position.x / 20) * 20, y: Math.round(position.y / 20) * 20 };
			}
			for (const edge of this.flowEdges) {
				if (edge.fromNodeId !== id && edge.toNodeId !== id) continue;
				delete edge.fromSide; delete edge.toSide; delete edge.waypoints;
				getCollab()?.pushFlowEdgeChange(edge);
			}
			node.position = position;
			const c = getCollab();
			if (c?.connected) {
				const key = 'flow:' + id;
				this._dragAwarenessPending.set(key, { x: position.x, y: position.y });
				this._movePendingIds.add(key);
				if (!this._dragAwarenessTimer) {
					this._dragAwarenessTimer = setTimeout(() => {
						this._dragAwarenessTimer = null;
						if (this._dragAwarenessPending.size > 0) {
							const positions: Record<string, { x: number; y: number }> = {};
							for (const [k, v] of this._dragAwarenessPending) positions[k] = v;
							c.broadcastDragPositions(positions);
							this._dragAwarenessPending.clear();
						}
					}, 50);
				}
			}
		}
	}

	addFlowEdge(
		label: string,
		fromNodeId: string,
		toNodeId: string,
		condition?: 'yes' | 'no',
		sides?: { fromSide?: FlowEdge['fromSide']; toSide?: FlowEdge['toSide'] }
	): FlowEdge {
		this.pushHistory('Add flow edge');
		const edge: FlowEdge = { id: generateId(), label, fromNodeId, toNodeId, condition, fromSide: sides?.fromSide, toSide: sides?.toSide };
		this.flowEdges.push(edge);
		getCollab()?.registerNewItem(edge.id);
		this.selectedEdgeId = edge.id;
		getCollab()?.pushFlowEdgeChange(edge);
		return edge;
	}

	updateFlowEdge(id: string, updates: Partial<Pick<FlowEdge, 'label' | 'labelOffset' | 'condition' | 'waypoints' | 'lineStyle' | 'strokeWidth' | 'strokeDash' | 'edgeColor' | 'arrowHead' | 'arrowDirection' | 'startArrow' | 'endArrow' | 'routingMode' | 'fromSide' | 'toSide'>>) {
		if (this.deferEdit([id], () => this.updateFlowEdge(id, updates))) return;
		const edge = this.flowEdges.find((e) => e.id === id);
		if (!edge) return;
		this.pushHistory();
		if (updates.label !== undefined) edge.label = updates.label;
		if ('condition' in updates) edge.condition = updates.condition;
		if (updates.labelOffset !== undefined) edge.labelOffset = updates.labelOffset;
		if ('waypoints' in updates) edge.waypoints = updates.waypoints;
		if (updates.lineStyle !== undefined) edge.lineStyle = updates.lineStyle;
		if (updates.strokeWidth !== undefined) edge.strokeWidth = updates.strokeWidth;
		if (updates.strokeDash !== undefined) edge.strokeDash = updates.strokeDash;
		if (updates.edgeColor !== undefined) edge.edgeColor = updates.edgeColor;
		for (const key of ['arrowHead', 'arrowDirection', 'startArrow', 'endArrow', 'routingMode', 'fromSide', 'toSide'] as const) {
			if (key in updates) Object.assign(edge, { [key]: updates[key] });
		}
		if ('fromSide' in updates || 'toSide' in updates || 'routingMode' in updates) edge.waypoints = undefined;
		getCollab()?.pushFlowEdgeChange(edge);
	}

	removeFlowEdge(id: string) {
		if (this.deferEdit([id], () => this.removeFlowEdge(id))) return;
		this.pushHistory('Remove flow edge');
		if (this.selectedEdgeId === id) this.selectedEdgeId = null;

		this.dyingFlowEdgeIds = new Set([...this.dyingFlowEdgeIds, id]);
		setTimeout(() => {
			if (!this.dyingFlowEdgeIds.has(id)) return;
			this.flowEdges = this.flowEdges.filter((e) => e.id !== id);
			this.dyingFlowEdgeIds = new Set([...this.dyingFlowEdgeIds].filter(eid => eid !== id));
		}, 500);
		getCollab()?.pushFlowEdgeRemove(id);
		this.removeCommentsForTarget(id);
	}

	applyFlowchartLayout(layoutType: 'hierarchical-tb' | 'hierarchical-lr' | 'grid' | 'circular' | 'force') {
		if (this.deferEdit(this.editableItemIds, () => this.applyFlowchartLayout(layoutType))) return;
		if (this.flowNodes.length === 0) return;

		this.pushHistory('Apply layout');


		this._pendingLayouts++;
		import('$lib/utils/flowchart-layouts').then(({ applyLayout }) => {
			const collab = getCollab();
			if (collab?.connected && this.flowNodes.some(node => !collab.canEdit(node.id))) return;
			const result = applyLayout(layoutType, this.flowNodes, this.flowEdges);


			this.smoothTransition = true;

			for (const [nodeId, position] of result.positions) {
				const node = this.flowNodes.find(n => n.id === nodeId);
				if (node) {
					node.position = position;
					getCollab()?.pushFlowNodeChange(node);
				}
			}


			setTimeout(() => {
				this.smoothTransition = false;
			}, 300);
		}).finally(() => { this._pendingLayouts--; });
	}



	nextDFDProcessNumber(): string {
		if (!this.dfdCurrentParentId) return '0';
		const parent = this.dfdNodes.find(node => node.id === this.dfdCurrentParentId);
		const used = new Set(this.dfdVisibleNodes.filter(node => !node.boundarySourceId).map(node => node.processNumber));
		for (let number = 1; ; number++) {
			const candidate = this.dfdDrillPath.length === 1 ? `${number}.0` : `${(parent?.processNumber ?? '1.0').replace(/\.0$/, '')}.${number}`;
			if (!used.has(candidate)) return candidate;
		}
	}
	private nextDFDStoreNumber(): string {
		const used = new Set(this.dfdNodes.map(node => node.storeNumber));
		for (let number = 1; ; number++) if (!used.has(`D${number}`)) return `D${number}`;
	}
	addDFDNode(name: string, type: DFDNodeType = 'process', position?: Position): DFDNode | null {
		if (this.viewOnly || getCollab()?.isViewer) return null;
		if (!this.dfdCurrentParentId && (type === 'data-store' || (type === 'process' && this.dfdVisibleNodes.some(node => node.type === 'process')))) {
			toast.warning('Level 0 requires one system process and no internal data stores');
			return null;
		}
		this.pushHistory('Add DFD node');
		const node: DFDNode = {
			id: generateId(),
			name,
			type,
			processNumber: type === 'process' ? this.nextDFDProcessNumber() : undefined,
			storeNumber: type === 'data-store' ? this.nextDFDStoreNumber() : undefined,
			position: position ?? this.getNextPosition(),


			parentId: this.dfdCurrentParentId
		};
		this.dfdNodes.push(node);
		getCollab()?.registerNewItem(node.id);
		this.selectedNodeIds = [node.id];
		this.newEntityIds = new Set([...this.newEntityIds, node.id]);
		setTimeout(() => { this.newEntityIds = new Set([...this.newEntityIds].filter(id => id !== node.id)); }, 600);
		getCollab()?.pushDFDNodeChange(node);
		return node;
	}




	drillIntoDFDNode(id: string) {
		if (this.dfdDrillPath.length >= 2) { toast.info('DFD รองรับถึง Level 2 เท่านั้น'); return; }
		const node = this.dfdNodes.find((n) => n.id === id);
		if (!node || node.boundarySourceId || node.type !== 'process' || (node.parentId ?? undefined) !== this.dfdCurrentParentId) return;
		if (this.dfdDrillPath.includes(id)) return;


		if (!this.dfdNodes.some(n => n.parentId === id) && this.deferEdit([id], () => this.drillIntoDFDNode(id))) return;
		this._seedDFDChildLevel(node);
		this.dfdDrillPath = [...this.dfdDrillPath, id];
		this.clearSelection();
	}


	private _seedDFDChildLevel(parent: DFDNode) {

		if (this.dfdNodes.some((n) => n.parentId === parent.id)) return;


		const boundaryFlows = this.dfdFlows.filter(
			(f) =>
				(f.parentId ?? undefined) === (parent.parentId ?? undefined) &&
				(f.fromNodeId === parent.id || f.toNodeId === parent.id)
		);


		this.pushHistory('Seed DFD sub-diagram');
		const c = getCollab();


		const base = (parent.processNumber || '').replace(/\.0$/, '').trim();
		const seedProcess: DFDNode = {
			id: generateId(),
			name: parent.name || 'Process',
			type: 'process',
			processNumber: parent.parentId ? `${base || '1'}.1` : '1.0',
			position: { x: 480, y: 320 },
			parentId: parent.id
		};
		this.dfdNodes.push(seedProcess);
		c?.pushDFDNodeChange(seedProcess);


		const copyByOriginal = new Map<string, string>();
		const neighbourIds: string[] = [];
		for (const f of boundaryFlows) {
			const otherId = f.fromNodeId === parent.id ? f.toNodeId : f.fromNodeId;
			if (!copyByOriginal.has(otherId)) {
				copyByOriginal.set(otherId, generateId());
				neighbourIds.push(otherId);
			}
		}
		const R = 280;
		const cx = seedProcess.position.x;
		const cy = seedProcess.position.y;
		neighbourIds.forEach((origId, i) => {
			const orig = this.dfdNodes.find((n) => n.id === origId);
			if (!orig) return;
			const angle = (i / neighbourIds.length) * Math.PI * 2 - Math.PI / 2;
			const copy: DFDNode = {
				id: copyByOriginal.get(origId)!,
				name: orig.name,
				boundarySourceId: orig.id,
				type: orig.type,
				processNumber: orig.processNumber,
				storeNumber: orig.storeNumber,
				color: orig.color,
				position: { x: cx + Math.cos(angle) * R, y: cy + Math.sin(angle) * R },
				parentId: parent.id
			};
			this.dfdNodes.push(copy);
			c?.pushDFDNodeChange(copy);
		});


		for (const f of boundaryFlows) {
			const otherId = f.fromNodeId === parent.id ? f.toNodeId : f.fromNodeId;
			const copyId = copyByOriginal.get(otherId);
			if (!copyId) continue;
			const flow: DFDFlow = {
				id: generateId(),
				label: f.label,
				boundaryFlowId: f.id,
				fromNodeId: f.fromNodeId === parent.id ? seedProcess.id : copyId,
				toNodeId: f.toNodeId === parent.id ? seedProcess.id : copyId,
				parentId: parent.id
			};
			this.dfdFlows.push(flow);
		getCollab()?.registerNewItem(flow.id);
			c?.pushDFDFlowChange(flow);
		}
	}


	drillToDFDLevel(depth: number) {
		depth = Math.max(0, Math.min(2, Math.trunc(depth) || 0));
		this.dfdDrillPath = this.dfdDrillPath.slice(0, depth);
		this.clearSelection();
	}


	drillUpDFD() {
		if (this.dfdDrillPath.length === 0) return;
		this.dfdDrillPath = this.dfdDrillPath.slice(0, -1);
		this.clearSelection();
	}


	resetDFDDrill() {
		this.dfdDrillPath = [];
	}


	private _dfdDescendantNodeIds(rootId: string): Set<string> {
		const result = new Set<string>();
		let frontier = [rootId];
		while (frontier.length > 0) {
			const next: string[] = [];
			for (const n of this.dfdNodes) {
				if (n.parentId && frontier.includes(n.parentId) && !result.has(n.id)) {
					result.add(n.id);
					next.push(n.id);
				}
			}
			frontier = next;
		}
		return result;
	}

	updateDFDNode(id: string, updates: Partial<Pick<DFDNode, 'name' | 'type' | 'processNumber' | 'storeNumber' | 'color' | 'width' | 'height'>>) {
		if (this.deferEdit([id], () => this.updateDFDNode(id, updates))) return;
		const node = this.dfdNodes.find((n) => n.id === id);
		if (!node) return;
		if (node.boundarySourceId && ('name' in updates || 'type' in updates || 'processNumber' in updates || 'storeNumber' in updates)) return;
		this.pushHistory();
		if (updates.name !== undefined) node.name = updates.name;
		if (updates.type !== undefined) node.type = updates.type;
		if (updates.processNumber !== undefined) node.processNumber = updates.processNumber;
		if (updates.storeNumber !== undefined) node.storeNumber = updates.storeNumber;
		if (updates.width !== undefined) node.width = updates.width;
		if (updates.height !== undefined) node.height = updates.height;
		if (updates.color !== undefined) node.color = updates.color;
		getCollab()?.pushDFDNodeChange(node);
		for (const reference of this.dfdNodes.filter(item => item.boundarySourceId === node.id)) {
			reference.name = node.name; reference.type = node.type; reference.processNumber = node.processNumber; reference.storeNumber = node.storeNumber;
			getCollab()?.pushDFDNodeChange(reference);
		}
	}

	removeDFDNode(id: string) {
		if (this.deferEdit(this.editDependencies([id]), () => this.removeDFDNode(id))) return;
		this.pushHistory('Remove DFD node');
		const c = getCollab();


		const connectedFlows = this.dfdFlows.filter(f => f.fromNodeId === id || f.toNodeId === id);
		if (connectedFlows.length > 0) {
			const flowIds = connectedFlows.map(f => f.id);
			this.dyingDFDFlowIds = new Set([...this.dyingDFDFlowIds, ...flowIds]);
			for (const f of connectedFlows) c?.pushDFDFlowRemove(f.id);
			setTimeout(() => {
				this.dfdFlows = this.dfdFlows.filter(f => !flowIds.includes(f.id));
				this.dyingDFDFlowIds = new Set([...this.dyingDFDFlowIds].filter(fid => !flowIds.includes(fid)));
			}, 700);
		}


		const dying = this.dfdNodes.find(n => n.id === id);
		if (dying) {
			const rect = this._getDFDNodeRect(dying);
			this.dyingDFDNodes = [...this.dyingDFDNodes, { ...dying, _dyingRect: rect }];
			setTimeout(() => { this.dyingDFDNodes = this.dyingDFDNodes.filter(n => n.id !== id); }, 900);
		}



		const descendants = this._dfdDescendantNodeIds(id);
		if (descendants.size > 0) {
			for (const did of descendants) c?.pushDFDNodeRemove(did);

			const removedFlowIds = this.dfdFlows
				.filter((f) =>
					(f.parentId && descendants.has(f.parentId)) ||
					descendants.has(f.fromNodeId) ||
					descendants.has(f.toNodeId)
				)
				.map((f) => f.id);
			for (const fid of removedFlowIds) c?.pushDFDFlowRemove(fid);
			this.dfdFlows = this.dfdFlows.filter((f) => !removedFlowIds.includes(f.id));
			this.dfdNodes = this.dfdNodes.filter((n) => !descendants.has(n.id));
		}

		this.dfdNodes = this.dfdNodes.filter((n) => n.id !== id);
		this.selectedNodeIds = this.selectedNodeIds.filter((nid) => nid !== id);
		c?.pushDFDNodeRemove(id);



		if (this.dfdDrillPath.includes(id) || [...descendants].some((d) => this.dfdDrillPath.includes(d))) {
			const cut = this.dfdDrillPath.findIndex((p) => p === id || descendants.has(p));
			if (cut >= 0) this.dfdDrillPath = this.dfdDrillPath.slice(0, cut);
		}
	}

	private _getDFDNodeRect(node: DFDNode): { x: number; y: number; width: number; height: number } {
		const cx = node.position.x;
		const cy = node.position.y;
		if (node.type === 'process') {
			const w = node.width ?? 140;
			const headerH = node.processNumber ? 28 : 0;
			const h = node.height ?? (headerH + 50);
			return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
		} else if (node.type === 'external-entity') {
			const w = node.width ?? 120, h = node.height ?? 50;
			return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
		} else {
			const w = node.width ?? 140, h = node.height ?? 40;
			return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
		}
	}

	moveDFDNode(id: string, position: Position) {
		if (this.viewOnly || (getCollab()?.connected && !getCollab()?.canEdit(id))) return;
		const node = this.dfdNodes.find((n) => n.id === id);
		if (node) {
			if (this.showGrid) {
				position = { x: Math.round(position.x / 20) * 20, y: Math.round(position.y / 20) * 20 };
			}
			node.position = position;
			const c = getCollab();
			if (c?.connected) {
				const key = 'dfd:' + id;
				this._dragAwarenessPending.set(key, { x: position.x, y: position.y });
				this._movePendingIds.add(key);
				if (!this._dragAwarenessTimer) {
					this._dragAwarenessTimer = setTimeout(() => {
						this._dragAwarenessTimer = null;
						if (this._dragAwarenessPending.size > 0) {
							const positions: Record<string, { x: number; y: number }> = {};
							for (const [k, v] of this._dragAwarenessPending) positions[k] = v;
							c.broadcastDragPositions(positions);
							this._dragAwarenessPending.clear();
						}
					}, 50);
				}
			}
		}
	}

	addDFDFlow(label: string, fromNodeId: string, toNodeId: string, fromSide?: 'top' | 'right' | 'bottom' | 'left', toSide?: 'top' | 'right' | 'bottom' | 'left', fromPortOffset?: number, toPortOffset?: number, waypoints?: Position[]): DFDFlow | null {
		const from = this.dfdVisibleNodes.find(n => n.id === fromNodeId);
		const to = this.dfdVisibleNodes.find(n => n.id === toNodeId);
		if (!from || !to || from.id === to.id || (from.type !== 'process' && to.type !== 'process') || (from.boundarySourceId && to.boundarySourceId)) {
			toast.warning('DFD ต้องเชื่อม Node ใน Level เดียวกัน และมี Process อย่างน้อยหนึ่งด้าน');
			return null;
		}
		this.pushHistory('Add DFD flow');
		const flow: DFDFlow = { id: generateId(), label, fromNodeId, toNodeId, fromSide, toSide, fromPortOffset, toPortOffset, waypoints, parentId: this.dfdCurrentParentId };
		this.dfdFlows.push(flow);
		getCollab()?.registerNewItem(flow.id);
		this.selectedEdgeId = flow.id;
		this.newDFDFlowIds = new Set([...this.newDFDFlowIds, flow.id]);
		setTimeout(() => { this.newDFDFlowIds = new Set([...this.newDFDFlowIds].filter(id => id !== flow.id)); }, 1000);
		getCollab()?.pushDFDFlowChange(flow);
		return flow;
	}

	updateDFDFlow(id: string, updates: Partial<Pick<DFDFlow, 'label' | 'waypoints' | 'fromSide' | 'toSide' | 'labelPosition'>>) {
		if (this.deferEdit([id], () => this.updateDFDFlow(id, updates))) return;
		const flow = this.dfdFlows.find((f) => f.id === id);
		if (!flow) return;
		this.pushHistory();
		if (updates.label !== undefined) flow.label = updates.label;
		if (updates.waypoints !== undefined) flow.waypoints = updates.waypoints;
		if (updates.fromSide !== undefined) flow.fromSide = updates.fromSide;
		if (updates.toSide !== undefined) flow.toSide = updates.toSide;
		if (updates.labelPosition !== undefined) flow.labelPosition = updates.labelPosition;
		getCollab()?.pushDFDFlowChange(flow);
	}

	removeDFDFlow(id: string) {
		if (this.deferEdit([id], () => this.removeDFDFlow(id))) return;
		this.pushHistory('Remove DFD flow');
		if (this.selectedEdgeId === id) this.selectedEdgeId = null;

		this.dyingDFDFlowIds = new Set([...this.dyingDFDFlowIds, id]);
		setTimeout(() => {
			if (!this.dyingDFDFlowIds.has(id)) return;
			this.dfdFlows = this.dfdFlows.filter((f) => f.id !== id);
			this.dyingDFDFlowIds = new Set([...this.dyingDFDFlowIds].filter(fid => fid !== id));
		}, 700);
		getCollab()?.pushDFDFlowRemove(id);
		this.removeCommentsForTarget(id);
	}


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
					name: src.name ,
					attributes: src.attributes.map((a) => ({ ...a, id: generateId() })),
					position: { x: src.position.x + 30, y: src.position.y + 30 },
					isWeak: src.isWeak,
					color: src.color
				};
				this.entities.push(entity);
		getCollab()?.registerNewItem(entity.id);
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
					name: src.name ,
					type: src.type,
					position: { x: src.position.x + 30, y: src.position.y + 30 },
					color: src.color
				};
				this.flowNodes.push(node);
		getCollab()?.registerNewItem(node.id);
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
					name: src.name ,
					type: src.type,
					processNumber: src.processNumber,
					position: { x: src.position.x + 30, y: src.position.y + 30 },
					color: src.color
				};
				this.dfdNodes.push(node);
		getCollab()?.registerNewItem(node.id);
				getCollab()?.pushDFDNodeChange(node);
				newIds.push(newId);
			}
		}

		this.selectedNodeIds = newIds;
	}






	flowAutoLayout(duration = 300) {
		if (this.deferEdit(this.editableItemIds, () => this.flowAutoLayout(duration))) return;
		const n = this.flowNodes.length;
		if (n === 0) return;

		this.cancelAnimation();
		const gen = ++this._layoutGen;

		const nodes = [...this.flowNodes];
		const edges = [...this.flowEdges];
		const dir = 'DOWN';

		this._pendingLayouts++;
		getElk()
			.then((m) => m.computeFlowELKLayout(nodes, edges, dir))
			.then((positions) => {
				if (gen !== this._layoutGen) return;
				if (positions && positions.size > 0) {
					this._startFlowAnimation(positions, duration, positions.routes);
				} else {
					this._startFlowAnimation(this._computeFlowBFSLayout(), duration);
				}
			})
			.catch(() => {
				if (gen !== this._layoutGen) return;
				this._startFlowAnimation(this._computeFlowBFSLayout(), duration);
			}).finally(() => { this._pendingLayouts--; });
	}


	private _computeFlowBFSLayout(): Map<string, Position> {
		const GAP_X = 180;
		const GAP_Y = 120;

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

		let roots = this.flowNodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0 && n.type === 'start-end').map((n) => n.id);
		if (roots.length === 0) {
			roots = this.flowNodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
		}
		if (roots.length === 0) roots = [this.flowNodes[0].id];

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

		for (const node of this.flowNodes) {
			if (!layerOf.has(node.id)) {
				const lastLayer = layers.length;
				if (!layers[lastLayer]) layers[lastLayer] = [];
				layers[lastLayer].push(node.id);
			}
		}

		const raw = new Map<string, Position>();
		for (let li = 0; li < layers.length; li++) {
			const layer = layers[li];
			const totalWidth = (layer.length - 1) * GAP_X;
			const startX = -totalWidth / 2;
			for (let ni = 0; ni < layer.length; ni++) {
				raw.set(layer[ni], { x: startX + ni * GAP_X, y: li * GAP_Y });
			}
		}

		let minX = Infinity, minY = Infinity;
		for (const pos of raw.values()) {
			minX = Math.min(minX, pos.x);
			minY = Math.min(minY, pos.y);
		}
		const positions = new Map<string, Position>();
		for (const [id, pos] of raw) {
			positions.set(id, { x: Math.round(pos.x - minX + 60), y: Math.round(pos.y - minY + 60) });
		}
		return positions;
	}


	private _startFlowAnimation(targetPositions: Map<string, Position>, _duration: number, routes?: import('$lib/utils/elk-layout').FlowLayoutPositions['routes']) {
		this.cancelAnimation();

		const oldPositions = new Map<string, Position>();
		for (const node of this.flowNodes) {
			oldPositions.set(node.id, { ...node.position });
		}

		this.pushHistory('Auto layout');



		const c0 = getCollab();
		for (const edge of this.flowEdges) {
			if (edge.waypoints || edge.fromSide || edge.toSide) {
				delete edge.waypoints;
				delete edge.fromSide;
				delete edge.toSide;
				c0?.pushFlowEdgeChange(edge);
			}
		}


		const elasticOut = (t: number): number => {
			if (t === 0 || t === 1) return t;
			return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
		};

		const STAGGER_MAX = 200;
		const NODE_DUR = 600;
		const TOTAL_DUR = STAGGER_MAX + NODE_DUR;


		let cx = 0, cy = 0, count = 0;
		for (const pos of targetPositions.values()) { cx += pos.x; cy += pos.y; count++; }
		if (count > 0) { cx /= count; cy /= count; }

		const delays = new Map<string, number>();
		let maxDist = 0;
		for (const [id, pos] of targetPositions) {
			const dist = Math.hypot(pos.x - cx, pos.y - cy);
			if (dist > maxDist) maxDist = dist;
			delays.set(id, dist);
		}
		for (const [id, dist] of delays) {
			delays.set(id, maxDist > 0 ? (dist / maxDist) * STAGGER_MAX : 0);
		}

		this.animating = true;

		this._safetyTimer = setTimeout(() => {
			this.animating = false;
			this._animationFrameId = 0;
			this._safetyTimer = null;
		}, TOTAL_DUR + 500);

		const startTime = performance.now();

		const animate = (now: number) => {
			if (getCollab()?.connected && [...targetPositions.keys()].some(id => !getCollab()?.canEdit(id))) { this.cancelAnimation(); return; }
			try {
				const elapsed = now - startTime;
				let allDone = true;
				for (const node of this.flowNodes) {
					const from = oldPositions.get(node.id);
					const to = targetPositions.get(node.id);
					if (!from || !to) continue;

					const delay = delays.get(node.id) ?? 0;
					const localT = Math.min(Math.max((elapsed - delay) / NODE_DUR, 0), 1);
					const t = elasticOut(localT);

					node.position = {
						x: from.x + (to.x - from.x) * t,
						y: from.y + (to.y - from.y) * t
					};

					if (localT < 1) allDone = false;
				}

				if (!allDone) {
					this._animationFrameId = requestAnimationFrame(animate);
				} else {
					const c = getCollab();
					for (const node of this.flowNodes) {
						const to = targetPositions.get(node.id);
						if (to) {
							node.position = { x: Math.round(to.x), y: Math.round(to.y) };
							c?.pushFlowNodeChange(node);
						}
					}

					if (routes) for (const edge of this.flowEdges) {
					 const route = routes.get(edge.id);
					 if (!route) continue;
					 edge.waypoints = route.waypoints; edge.fromSide = route.fromSide; edge.toSide = route.toSide; edge.lineStyle = 'orthogonal';
					 c?.pushFlowEdgeChange(edge);
					}

					if (this._safetyTimer) { clearTimeout(this._safetyTimer); this._safetyTimer = null; }
					this._animationFrameId = 0;
					this.animating = false;

					this.smoothTransition = true;
					if (this.canvasWidth > 0 && this.canvasHeight > 0) {
						this.fitToContent(this.canvasWidth, this.canvasHeight);
					} else {
						this.panX = 0;
						this.panY = 0;
						this.zoom = 1;
					}
					setTimeout(() => { this.smoothTransition = false; }, 300);
				}
			} catch {
				if (this._safetyTimer) { clearTimeout(this._safetyTimer); this._safetyTimer = null; }
				this._animationFrameId = 0;
				this.animating = false;
			}
		};

		this._animationFrameId = requestAnimationFrame(animate);
	}


	dfdAutoLayout() {
		if (this.deferEdit(this.editableItemIds, () => this.dfdAutoLayout())) return;



		const visible = this.dfdVisibleNodes;
		if (visible.length === 0) return;
		this.pushHistory('Auto layout');

		const processes = visible.filter((v) => v.type === 'process');
		const externals = visible.filter((v) => v.type === 'external-entity');
		const stores = visible.filter((v) => v.type === 'data-store');

		const centerX = 500;
		const centerY = 400;




		const ringRadius = (count: number, spacing: number, base: number): number => {
			if (count <= 1) return base;
			return Math.max(base, Math.round((count * spacing) / (2 * Math.PI)));
		};


		const placeRing = (nodes: DFDNode[], r: number, startAngle = -Math.PI / 2) => {
			const step = (Math.PI * 2) / Math.max(nodes.length, 1);
			for (let i = 0; i < nodes.length; i++) {
				const angle = startAngle + i * step;
				nodes[i].position = {
					x: Math.round(centerX + Math.cos(angle) * r),
					y: Math.round(centerY + Math.sin(angle) * r)
				};
			}
		};


		const RING_SPACING = 230;

		if (processes.length <= 1) {


			if (processes.length === 1) {
				processes[0].position = { x: centerX, y: centerY };
			}
			const peripheral = [...externals, ...stores];
			const r = ringRadius(peripheral.length, RING_SPACING, 320);
			placeRing(peripheral, r);
		} else {


			const innerR = ringRadius(processes.length, RING_SPACING, 200);
			placeRing(processes, innerR);
			const peripheral = [...externals, ...stores];
			const outerR = Math.max(
				ringRadius(peripheral.length, RING_SPACING, 0),
				innerR + 300
			);
			placeRing(peripheral, outerR);
		}


		let minX = Infinity, minY = Infinity;
		for (const node of visible) {
			minX = Math.min(minX, node.position.x);
			minY = Math.min(minY, node.position.y);
		}
		const c = getCollab();
		for (const node of visible) {
			node.position = {
				x: Math.round(node.position.x - minX + 60),
				y: Math.round(node.position.y - minY + 60)
			};
			c?.pushDFDNodeChange(node);
		}

		if (this.canvasWidth > 0 && this.canvasHeight > 0) {
			this.fitToContent(this.canvasWidth, this.canvasHeight);
		} else {
			this.panX = 0;
			this.panY = 0;
			this.zoom = 1;
		}
	}


	physicsMode = $state(false);
	private _physicsFrameId = 0;
	private _physicsSim: PhysicsSimulation | null = null;

	async togglePhysics() {
		if (this.physicsMode) this.stopPhysics();
	}

	startPhysics() {
		// Physics mode has been retired. Keep this entry point for older collaboration clients.
	}

	stopPhysics() {
		this.physicsMode = false;
		if (this._physicsFrameId) {
			cancelAnimationFrame(this._physicsFrameId);
			this._physicsFrameId = 0;
		}

		this.pushHistory('Physics layout');

		const c = getCollab();
		if (c) {

			c.broadcastPhysicsStop();

			if (this.diagramType === 'er') {
				for (const e of this.entities) c.pushEntityChange(e);
			} else if (this.diagramType === 'flowchart') {
				for (const n of this.flowNodes) c.pushFlowNodeChange(n);
			} else if (this.diagramType === 'context') {
				for (const n of this.dfdNodes) c.pushDFDNodeChange(n);
			}
		}
		this._physicsSim = null;
	}

	physicsPin(id: string) {
		this._physicsSim?.pin(id);
	}

	physicsUnpin(id: string) {
		this._physicsSim?.unpin(id);
	}

	physicsMoveBody(id: string, x: number, y: number) {
		this._physicsSim?.moveBody(id, x, y);
	}


	physicsSyncBodies() {
		if (!this._physicsSim || !this.physicsMode) return;
		const sim = this._physicsSim;

		if (this.diagramType === 'er') {
			const currentIds = new Set(this.entities.map(e => e.id));

			for (const e of this.entities) {
				if (!sim.bodies.has(e.id)) {
					sim.addBody(e.id, e.position.x, e.position.y);
				}
			}

			for (const id of sim.bodies.keys()) {
				if (!currentIds.has(id)) sim.removeBody(id);
			}

			sim.setSprings(
				this.relationships.map(r => ({
					fromId: r.entityIds[0],
					toId: r.entityIds[1],
					restLength: 200
				}))
			);
		} else if (this.diagramType === 'flowchart') {
			const currentIds = new Set(this.flowNodes.map(n => n.id));
			for (const n of this.flowNodes) {
				if (!sim.bodies.has(n.id)) sim.addBody(n.id, n.position.x, n.position.y);
			}
			for (const id of sim.bodies.keys()) {
				if (!currentIds.has(id)) sim.removeBody(id);
			}
			sim.setSprings(
				this.flowEdges.map(e => ({
					fromId: e.fromNodeId,
					toId: e.toNodeId,
					restLength: 200
				}))
			);
		} else if (this.diagramType === 'context') {
			const currentIds = new Set(this.dfdNodes.map(n => n.id));
			for (const n of this.dfdNodes) {
				if (!sim.bodies.has(n.id)) sim.addBody(n.id, n.position.x, n.position.y);
			}
			for (const id of sim.bodies.keys()) {
				if (!currentIds.has(id)) sim.removeBody(id);
			}
			sim.setSprings(
				this.dfdFlows.map(f => ({
					fromId: f.fromNodeId,
					toId: f.toNodeId,
					restLength: 200
				}))
			);
		}
	}

	private _physicsFrameCount = 0;

	private _physicsLoop() {
		if (getCollab()?.connected && this.editableItemIds.some(id => !getCollab()?.canEdit(id))) { this.physicsMode = false; this._physicsSim = null; return; }
		if (!this.physicsMode || !this._physicsSim) return;
		const sim = this._physicsSim;
		sim.step();
		const positions = sim.getPositions();


		if (this.diagramType === 'er') {
			for (const e of this.entities) {
				const pos = positions.get(e.id);
				if (pos) {
					e.position = { x: pos.x, y: pos.y };
				}
			}
		} else if (this.diagramType === 'flowchart') {
			for (const n of this.flowNodes) {
				const pos = positions.get(n.id);
				if (pos) {
					n.position = { x: pos.x, y: pos.y };
				}
			}
		} else if (this.diagramType === 'context') {
			for (const n of this.dfdNodes) {
				const pos = positions.get(n.id);
				if (pos) {
					n.position = { x: pos.x, y: pos.y };
				}
			}
		}


		this._physicsFrameCount++;
		if (this._physicsFrameCount % 3 === 0) {
			const c = getCollab();
			if (c?.connected) {
				const posObj: Record<string, { x: number; y: number }> = {};
				for (const [id, pos] of positions) {
					posObj[id] = { x: Math.round(pos.x), y: Math.round(pos.y) };
				}
				c.broadcastPhysicsPositions(posObj);
			}
		}


		if (this.physicsMode) {
			this._physicsFrameId = requestAnimationFrame(() => this._physicsLoop());
		}
	}

	resetAll() {
		if (this.deferEdit(this.editableItemIds, () => this.resetAll())) return;
		this.diagramType = 'er';
		this.entities = [];
		this.relationships = [];
		this.notes = [];
		this.notation = 'crows-foot';
		this.flowNodes = [];
		this.flowEdges = [];
		this.dfdNodes = [];
		this.dfdFlows = [];
		this.dfdDrillPath = [];
		this.diagramFont = "'Kanit', sans-serif";
		this.diagramFontSize = 14;
		this.customFonts = [];
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
