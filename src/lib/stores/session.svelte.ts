import type { DiagramMeta, DiagramData } from '$lib/types/session';
import type { NotationStyle } from '$lib/types/notation';
import type { DiagramType } from '$lib/types/diagram';
import { auth } from '$lib/stores/auth.svelte';
import { diagram } from '$lib/stores/diagram.svelte';
import { sync } from '$lib/stores/sync.svelte';
import { generateId } from '$lib/utils/id';
import { safeSave } from '$lib/utils/storage';


let _collab: { pushDiagramName: (name: string) => void; connected: boolean } | null = null;
export function registerCollabForSession(c: typeof _collab) {
	_collab = c;
}

class SessionState {
	diagrams = $state<DiagramMeta[]>([]);
	activeDiagramId = $state<string | null>(null);
	isFirstTime = $state(false);


	suppressAutoSave = false;


	private _syncAppliedIds = new Set<string>();

	private _lastSyncApplyTime = 0;

	private _knownCloudIds = new Set<string>();


	get hasPendingSave(): boolean {
		return this.saveTimer !== null;
	}


	get activeDiagramName(): string {
		const meta = this.diagrams.find((d) => d.id === this.activeDiagramId);
		return meta?.name ?? '';
	}

	private saveTimer: ReturnType<typeof setTimeout> | null = null;

	private key(suffix: string): string {
		return `${auth.storagePrefix}:${suffix}`;
	}

	initSession() {




		this.isFirstTime = false;


		try {
			const raw = localStorage.getItem(this.key('diagrams'));
			this.diagrams = raw ? JSON.parse(raw) : [];
		} catch {
			this.diagrams = [];
		}


		const activeId = localStorage.getItem(this.key('active'));

		if (this.diagrams.length === 0) {

			this.isFirstTime = true;
			this.createDiagram('Untitled Diagram');
		} else if (activeId && this.diagrams.some((d) => d.id === activeId)) {
			this.loadDiagram(activeId);
		} else {
			this.loadDiagram(this.diagrams[0].id);
		}


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
			diagramFontSize: diagram.diagramFontSize,
			panX: diagram.panX,
			panY: diagram.panY,
			zoom: diagram.zoom,
			diagramType: diagram.diagramType,
			flowNodes: $state.snapshot(diagram.flowNodes),
			flowEdges: $state.snapshot(diagram.flowEdges),
			dfdNodes: $state.snapshot(diagram.dfdNodes),
			dfdFlows: $state.snapshot(diagram.dfdFlows),
			customFonts: $state.snapshot(diagram.customFonts)
		};

		safeSave(
			this.key(`diagram:${this.activeDiagramId}`),
			JSON.stringify(data)
		);


		const id = this.activeDiagramId;
		if (this._syncAppliedIds.has(id) && Date.now() - this._lastSyncApplyTime < 2000) {
			this._syncAppliedIds.delete(id);

			return;
		}


		const meta = this.diagrams.find((d) => d.id === id);
		if (meta) {
			meta.updatedAt = Date.now();
			this.saveMeta();


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
				diagram.diagramFontSize = data.diagramFontSize ?? 14;
				diagram.panX = data.panX;
				diagram.panY = data.panY;
				diagram.zoom = data.zoom;
				diagram.flowNodes = data.flowNodes ?? [];
				diagram.flowEdges = data.flowEdges ?? [];
				diagram.dfdNodes = data.dfdNodes ?? [];
				diagram.dfdFlows = data.dfdFlows ?? [];
				diagram.customFonts = data.customFonts ?? [];


				if (typeof document !== 'undefined') {
					for (const font of diagram.customFonts) {
						if (!document.querySelector(`link[data-custom-font="${font.label}"]`)) {
							const link = document.createElement('link');
							link.rel = 'stylesheet';
							link.href = font.url;
							link.dataset.customFont = font.label;
							document.head.appendChild(link);
						}
					}
				}
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


		diagram.resetAll();
		if (diagramType) diagram.diagramType = diagramType;
		this.activeDiagramId = id;
		safeSave(this.key('active'), id);
		this.saveDiagram();



		const created = this.diagrams.find((d) => d.id === id);
		if (created) {
			const data = this.readLocalData(id);
			if (data) sync.pushNow({ ...created }, data);
		}
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

		meta.updatedAt = Date.now();
		this.saveMeta();



		const data = this.readLocalData(id);
		if (data) sync.pushNow({ ...meta }, data);


		if (_collab?.connected && id === this.activeDiagramId) {
			_collab.pushDiagramName(newName);
		}
	}

	duplicateDiagram(id: string) {

		if (this.activeDiagramId) {
			this.saveDiagram();
		}

		const source = this.diagrams.find((d) => d.id === id);
		if (!source) return;


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


		if (data) {
			safeSave(this.key(`diagram:${newId}`), JSON.stringify(data));

			sync.pushNow({ ...meta }, data);
		}


		this.loadDiagram(newId);
	}

	deleteDiagram(id: string) {
		if (this.activeDiagramId === id && this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}


		const isLast = this.diagrams.length <= 1;

		this.diagrams = this.diagrams.filter((d) => d.id !== id);
		localStorage.removeItem(this.key(`diagram:${id}`));


		sync.pushDelete(id);

		if (isLast) {

			this.activeDiagramId = null;
			this.createDiagram('Untitled Diagram');
			return;
		}

		this.saveMeta();


		if (this.activeDiagramId === id) {
			this.loadDiagram(this.diagrams[0].id);
		}
	}


	private pushMetaChange(id: string) {
		const meta = this.diagrams.find((d) => d.id === id);
		if (!meta) return;

		meta.updatedAt = Date.now();
		this.saveMeta();
		const data = this.readLocalData(id);
		if (data) sync.pushNow({ ...meta }, data);
	}

	togglePin(id: string) {
		const meta = this.diagrams.find((d) => d.id === id);
		if (!meta) return;
		meta.pinned = !meta.pinned;
		this.sortDiagrams();
		this.pushMetaChange(id);
	}

	addTag(id: string, tag: string) {
		const meta = this.diagrams.find((d) => d.id === id);
		if (!meta) return;
		const trimmedTag = tag.trim();
		if (!trimmedTag) return;
		if (!meta.tags) meta.tags = [];
		if (meta.tags.includes(trimmedTag)) return;
		meta.tags.push(trimmedTag);
		this.pushMetaChange(id);
	}

	removeTag(id: string, tag: string) {
		const meta = this.diagrams.find((d) => d.id === id);
		if (!meta || !meta.tags) return;
		meta.tags = meta.tags.filter((t) => t !== tag);
		if (meta.tags.length === 0) delete meta.tags;
		this.pushMetaChange(id);
	}

	private sortDiagrams() {
		this.diagrams.sort((a, b) => {

			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;

			return b.updatedAt - a.updatedAt;
		});
	}

	scheduleSave() {
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => {
			this.saveDiagram();
			this.saveTimer = null;
		}, 300);
	}

	saveNow() {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		this.saveDiagram();
	}


	private readLocalData(id: string): DiagramData | null {
		try {
			const raw = localStorage.getItem(this.key(`diagram:${id}`));
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}


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


	triggerFullSync() {
		if (!sync.canSync) return;








		if (this.saveTimer) {
			this.saveNow();
		}

		const localMetas = [...$state.snapshot(this.diagrams)];
		const localActive = this.activeDiagramId;


		try {
			const raw = localStorage.getItem(this.key('knownCloudIds'));
			if (raw) {
				this._knownCloudIds = new Set(JSON.parse(raw));
			}
		} catch { /* ignore */ }

		sync.fullSync(
			localMetas,
			localActive,

			(id: string) => {
				try {
					const raw = localStorage.getItem(this.key(`diagram:${id}`));
					return raw ? JSON.parse(raw) : null;
				} catch {
					return null;
				}
			},

			(meta: DiagramMeta, data: DiagramData) => {

				this._syncAppliedIds.add(meta.id);
				this._lastSyncApplyTime = Date.now();



				let isNewOnDevice = true;
				try {
					const existingRaw = localStorage.getItem(this.key(`diagram:${meta.id}`));
					if (existingRaw) {
						isNewOnDevice = false;
						const existing = JSON.parse(existingRaw);
						data = { ...data, panX: existing.panX, panY: existing.panY, zoom: existing.zoom };
					}
				} catch { /* use cloud values for new diagrams */ }


				safeSave(this.key(`diagram:${meta.id}`), JSON.stringify(data));



				if (meta.id === this.activeDiagramId) {

					const savedPanX = diagram.panX;
					const savedPanY = diagram.panY;
					const savedZoom = diagram.zoom;

					this.suppressAutoSave = true;

					if (this.saveTimer) {
						clearTimeout(this.saveTimer);
						this.saveTimer = null;
					}
					this.loadDiagram(meta.id);

					if (isNewOnDevice) {

						diagram.fitToContent(window.innerWidth, window.innerHeight);
					} else {

						diagram.panX = savedPanX;
						diagram.panY = savedPanY;
						diagram.zoom = savedZoom;
					}


					setTimeout(() => {
						this.suppressAutoSave = false;

						this._syncAppliedIds.clear();
					}, 600);
				}
			},

			(id: string) => {
				this.loadDiagram(id);
			},

			(metas: DiagramMeta[]) => {
				this.diagrams = metas;
				this.saveMeta();

				safeSave(this.key('knownCloudIds'), JSON.stringify([...this._knownCloudIds]));
			},

			this._knownCloudIds,

			(id: string) => {
				localStorage.removeItem(this.key(`diagram:${id}`));


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
