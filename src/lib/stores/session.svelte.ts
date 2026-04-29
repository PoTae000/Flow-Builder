import type { DiagramMeta, DiagramData } from '$lib/types/session';
import type { NotationStyle } from '$lib/types/notation';
import type { DiagramType } from '$lib/types/diagram';
import { auth } from '$lib/stores/auth.svelte';
import { diagram } from '$lib/stores/diagram.svelte';
import { sync } from '$lib/stores/sync.svelte';
import { generateId } from '$lib/utils/id';
import { safeSave } from '$lib/utils/storage';

// Lazy import to avoid circular dependency
let _collab: { pushDiagramName: (name: string) => void; connected: boolean } | null = null;
export function registerCollabForSession(c: typeof _collab) {
	_collab = c;
}

class SessionState {
	diagrams = $state<DiagramMeta[]>([]);
	activeDiagramId = $state<string | null>(null);
	isFirstTime = $state(false);

	/** When true, auto-save $effect should skip. Plain (non-reactive) to avoid re-triggering $effect. */
	suppressAutoSave = false;

	/** Diagram IDs recently applied from cloud sync — skip push for these to prevent loops. */
	private _syncAppliedIds = new Set<string>();
	/** Timestamp when cloud data was last applied. */
	private _lastSyncApplyTime = 0;
	/** Diagram IDs known to exist on cloud — used to detect remote deletions. */
	private _knownCloudIds = new Set<string>();

	/** True if there are unsaved local edits (save timer pending). */
	get hasPendingSave(): boolean {
		return this.saveTimer !== null;
	}

	private saveTimer: ReturnType<typeof setTimeout> | null = null;

	private key(suffix: string): string {
		return `${auth.storagePrefix}:${suffix}`;
	}

	initSession() {
		// Load diagram list
		try {
			const raw = localStorage.getItem(this.key('diagrams'));
			this.diagrams = raw ? JSON.parse(raw) : [];
		} catch {
			this.diagrams = [];
		}

		// Load active diagram id
		const activeId = localStorage.getItem(this.key('active'));

		if (this.diagrams.length === 0) {
			// Create a default diagram
			this.isFirstTime = true;
			this.createDiagram('Untitled Diagram');
		} else if (activeId && this.diagrams.some((d) => d.id === activeId)) {
			this.loadDiagram(activeId);
		} else {
			this.loadDiagram(this.diagrams[0].id);
		}

		// Trigger cloud sync (async, non-blocking)
		this.triggerFullSync();
	}

	saveDiagram() {
		if (!this.activeDiagramId) return;

		const data: DiagramData = {
			entities: $state.snapshot(diagram.entities),
			relationships: $state.snapshot(diagram.relationships),
			notes: $state.snapshot(diagram.notes),
			notation: diagram.notation,
			diagramFont: diagram.diagramFont,
			panX: diagram.panX,
			panY: diagram.panY,
			zoom: diagram.zoom,
			diagramType: diagram.diagramType,
			flowNodes: $state.snapshot(diagram.flowNodes),
			flowEdges: $state.snapshot(diagram.flowEdges),
			dfdNodes: $state.snapshot(diagram.dfdNodes),
			dfdFlows: $state.snapshot(diagram.dfdFlows)
		};

		safeSave(
			this.key(`diagram:${this.activeDiagramId}`),
			JSON.stringify(data)
		);

		// Anti-loop: if this diagram was just applied from cloud sync, save locally but skip push
		const id = this.activeDiagramId;
		if (this._syncAppliedIds.has(id) && Date.now() - this._lastSyncApplyTime < 2000) {
			this._syncAppliedIds.delete(id);
			// Save meta without bumping updatedAt or pushing to cloud
			return;
		}

		// Update meta timestamp
		const meta = this.diagrams.find((d) => d.id === id);
		if (meta) {
			meta.updatedAt = Date.now();
			this.saveMeta();

			// Schedule cloud push
			sync.schedulePush({ ...meta }, data);
		}
	}

	loadDiagram(id: string) {
		try {
			const raw = localStorage.getItem(this.key(`diagram:${id}`));
			if (raw) {
				const data: DiagramData = JSON.parse(raw);
				diagram.resetAll();
				diagram.diagramType = data.diagramType ?? 'er';
				diagram.entities = data.entities;
				diagram.relationships = data.relationships;
				diagram.notes = data.notes ?? [];
				diagram.notation = data.notation as NotationStyle;
				diagram.diagramFont = data.diagramFont;
				diagram.panX = data.panX;
				diagram.panY = data.panY;
				diagram.zoom = data.zoom;
				diagram.flowNodes = data.flowNodes ?? [];
				diagram.flowEdges = data.flowEdges ?? [];
				diagram.dfdNodes = data.dfdNodes ?? [];
				diagram.dfdFlows = data.dfdFlows ?? [];
			} else {
				diagram.resetAll();
			}
		} catch {
			diagram.resetAll();
		}

		this.activeDiagramId = id;
		safeSave(this.key('active'), id);
	}

	createDiagram(name?: string, diagramType?: DiagramType) {
		// Save current diagram first
		if (this.activeDiagramId) {
			this.saveDiagram();
		}

		const id = generateId();
		const now = Date.now();
		const meta: DiagramMeta = {
			id,
			name: name ?? `Diagram ${this.diagrams.length + 1}`,
			diagramType: diagramType ?? 'er',
			createdAt: now,
			updatedAt: now
		};

		this.diagrams.push(meta);
		this.saveMeta();

		// Reset and switch to new diagram
		diagram.resetAll();
		if (diagramType) diagram.diagramType = diagramType;
		this.activeDiagramId = id;
		safeSave(this.key('active'), id);
		this.saveDiagram();
	}

	switchDiagram(id: string) {
		if (id === this.activeDiagramId) return;
		this.saveNow();
		this.loadDiagram(id);
	}

	renameDiagram(id: string, name: string) {
		const meta = this.diagrams.find((d) => d.id === id);
		if (!meta) return;
		const newName = name.trim() || meta.name;
		if (meta.name === newName) return;
		meta.name = newName;
		this.saveMeta();
		// Sync diagram name to collaborators
		if (_collab?.connected && id === this.activeDiagramId) {
			_collab.pushDiagramName(newName);
		}
	}

	duplicateDiagram(id: string) {
		// Save current first
		if (this.activeDiagramId) {
			this.saveDiagram();
		}

		const source = this.diagrams.find((d) => d.id === id);
		if (!source) return;

		// Read source diagram data
		let data: DiagramData | null = null;
		try {
			const raw = localStorage.getItem(this.key(`diagram:${id}`));
			if (raw) data = JSON.parse(raw);
		} catch { /* ignore */ }

		const newId = generateId();
		const now = Date.now();
		const meta: DiagramMeta = {
			id: newId,
			name: `${source.name} (copy)`,
			createdAt: now,
			updatedAt: now
		};

		this.diagrams.push(meta);
		this.saveMeta();

		// Save duplicated data
		if (data) {
			safeSave(this.key(`diagram:${newId}`), JSON.stringify(data));
		}

		// Switch to the new diagram
		this.loadDiagram(newId);
	}

	deleteDiagram(id: string) {
		if (this.diagrams.length <= 1) return; // don't delete last diagram

		this.diagrams = this.diagrams.filter((d) => d.id !== id);
		localStorage.removeItem(this.key(`diagram:${id}`));
		this.saveMeta();

		// Delete from cloud
		sync.pushDelete(id);

		// If we deleted the active diagram, switch to first remaining
		if (this.activeDiagramId === id) {
			this.loadDiagram(this.diagrams[0].id);
		}
	}

	scheduleSave() {
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => {
			this.saveDiagram();
			this.saveTimer = null;
		}, 500);
	}

	saveNow() {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		this.saveDiagram();
	}

	/** Save only viewport (panX/panY/zoom) to localStorage. No timestamp bump, no cloud push. */
	saveViewport() {
		if (!this.activeDiagramId) return;
		try {
			const raw = localStorage.getItem(this.key(`diagram:${this.activeDiagramId}`));
			if (raw) {
				const data = JSON.parse(raw);
				data.panX = diagram.panX;
				data.panY = diagram.panY;
				data.zoom = diagram.zoom;
				safeSave(this.key(`diagram:${this.activeDiagramId}`), JSON.stringify(data));
			}
		} catch { /* ignore */ }
	}

	/**
	 * Save current diagram data to localStorage only (no updatedAt bump, no cloud push).
	 * Used before sync to persist latest state without affecting timestamps.
	 */
	private saveLocalOnly() {
		if (!this.activeDiagramId) return;
		const data: DiagramData = {
			entities: $state.snapshot(diagram.entities),
			relationships: $state.snapshot(diagram.relationships),
			notes: $state.snapshot(diagram.notes),
			notation: diagram.notation,
			diagramFont: diagram.diagramFont,
			panX: diagram.panX,
			panY: diagram.panY,
			zoom: diagram.zoom,
			diagramType: diagram.diagramType,
			flowNodes: $state.snapshot(diagram.flowNodes),
			flowEdges: $state.snapshot(diagram.flowEdges),
			dfdNodes: $state.snapshot(diagram.dfdNodes),
			dfdFlows: $state.snapshot(diagram.dfdFlows)
		};
		safeSave(this.key(`diagram:${this.activeDiagramId}`), JSON.stringify(data));
	}

	/** Trigger a full cloud sync (async, non-blocking). */
	triggerFullSync() {
		if (!sync.canSync) return;

		// Save current data to localStorage WITHOUT bumping updatedAt or pushing.
		// This ensures getLocalData() returns the latest state for comparison,
		// but doesn't make local appear "newer" than cloud.
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
			this.saveLocalOnly();
		}

		const localMetas = [...$state.snapshot(this.diagrams)];
		const localActive = this.activeDiagramId;

		// Load known cloud IDs from localStorage (persists across page reloads)
		try {
			const raw = localStorage.getItem(this.key('knownCloudIds'));
			if (raw) {
				this._knownCloudIds = new Set(JSON.parse(raw));
			}
		} catch { /* ignore */ }

		sync.fullSync(
			localMetas,
			localActive,
			// getLocalData
			(id: string) => {
				try {
					const raw = localStorage.getItem(this.key(`diagram:${id}`));
					return raw ? JSON.parse(raw) : null;
				} catch {
					return null;
				}
			},
			// applyCloudDiagram
			(meta: DiagramMeta, data: DiagramData) => {
				// Track that this diagram came from cloud (anti-loop layer 3)
				this._syncAppliedIds.add(meta.id);
				this._lastSyncApplyTime = Date.now();

				// Preserve local viewport — panX/panY/zoom are device-specific
				// (phone vs desktop have very different zoom levels)
				let isNewOnDevice = true;
				try {
					const existingRaw = localStorage.getItem(this.key(`diagram:${meta.id}`));
					if (existingRaw) {
						isNewOnDevice = false;
						const existing = JSON.parse(existingRaw);
						data = { ...data, panX: existing.panX, panY: existing.panY, zoom: existing.zoom };
					}
				} catch { /* use cloud values for new diagrams */ }

				// Save cloud data to localStorage (with local viewport preserved)
				safeSave(this.key(`diagram:${meta.id}`), JSON.stringify(data));

				// If this is the active diagram, reload it into the canvas
				// Suppress auto-save to prevent pushing the same data back with new timestamp
				if (meta.id === this.activeDiagramId) {
					// Save current viewport before reload
					const savedPanX = diagram.panX;
					const savedPanY = diagram.panY;
					const savedZoom = diagram.zoom;

					this.suppressAutoSave = true;
					// Cancel any pending save timer
					if (this.saveTimer) {
						clearTimeout(this.saveTimer);
						this.saveTimer = null;
					}
					this.loadDiagram(meta.id);

					if (isNewOnDevice) {
						// First time seeing this diagram on this device — auto-fit to show all content
						diagram.fitToContent(window.innerWidth, window.innerHeight);
					} else {
						// Restore viewport — don't let cloud overwrite device-specific zoom/pan
						diagram.panX = savedPanX;
						diagram.panY = savedPanY;
						diagram.zoom = savedZoom;
					}

					// Wait for Svelte effects to flush, then re-enable auto-save
					setTimeout(() => {
						this.suppressAutoSave = false;
						// Clear sync applied IDs after suppress window
						this._syncAppliedIds.clear();
					}, 600);
				}
			},
			// applyCloudActive
			(id: string) => {
				this.loadDiagram(id);
			},
			// setMetas
			(metas: DiagramMeta[]) => {
				this.diagrams = metas;
				this.saveMeta();
				// Persist known cloud IDs for next sync
				safeSave(this.key('knownCloudIds'), JSON.stringify([...this._knownCloudIds]));
			},
			// knownCloudIds
			this._knownCloudIds,
			// deleteLocalDiagram (remote deletion)
			(id: string) => {
				localStorage.removeItem(this.key(`diagram:${id}`));

				// If deleting the active diagram, switch to another one first
				if (id === this.activeDiagramId) {
					const remaining = this.diagrams.filter((d) => d.id !== id);
					if (remaining.length > 0) {
						this.loadDiagram(remaining[0].id);
					}
				}
			}
		);
	}

	private saveMeta() {
		safeSave(
			this.key('diagrams'),
			JSON.stringify($state.snapshot(this.diagrams))
		);
	}
}

export const session = new SessionState();
