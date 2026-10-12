

import { diagram } from './diagram.svelte';
import { type DiagramFileHandle, writeToFile, isFileSystemSupported, verifyPermission } from '$lib/utils/file-system';


let _collab: { pushSaveEvent: () => void; connected: boolean } | null = null;
export function registerCollab(c: typeof _collab) {
	_collab = c;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';


let _session: { activeDiagramId: string | null; activeDiagramName: string } | null = null;
export function registerSession(s: typeof _session) {
	_session = s;
}

class AutoSaveState {

	private fileHandles = $state<Map<string, DiagramFileHandle>>(new Map());


	status = $state<SaveStatus>('idle');
	lastSaveTime = $state<number | null>(null);
	errorMessage = $state<string | null>(null);


	enabled = $state(true);
	interval = $state(10000);


	private saveTimer: ReturnType<typeof setInterval> | null = null;
	private lastDiagramState: string | null = null;
	private lastDiagramId: string | null = null;
	private savedStates = new Map<string, string>();

	get hasUnsavedChanges(): boolean {
		const id = _session?.activeDiagramId;
		return !id || this.savedStates.get(id) !== this.contentState(this.getDiagramData());
	}

	private contentState(data: object): string {
		const { savedAt, ...content } = data as Record<string, unknown>;
		return JSON.stringify(content);
	}

	markFileSaved(data: object) {
		const id = _session?.activeDiagramId;
		if (id) this.savedStates.set(id, this.contentState(data));
	}


	fileHandle = $state<DiagramFileHandle | null>(null);


	private updateFileHandle() {
		const diagramId = _session?.activeDiagramId;
		this.fileHandle = diagramId ? (this.fileHandles.get(diagramId) || null) : null;
	}

	get isSupported(): boolean {
		return isFileSystemSupported();
	}

	get statusText(): string {
		if (!this.fileHandle) return 'ไม่ได้เลือกที่บันทึก';
		if (this.status === 'saving') return 'กำลังบันทึก...';
		if (this.status === 'saved') {
			if (this.lastSaveTime) {
				const secondsAgo = Math.floor((Date.now() - this.lastSaveTime) / 1000);
				if (secondsAgo < 60) return `บันทึกแล้ว ${secondsAgo} วินาทีที่แล้ว`;
				const minutesAgo = Math.floor(secondsAgo / 60);
				return `บันทึกแล้ว ${minutesAgo} นาทีที่แล้ว`;
			}
			return 'บันทึกแล้ว';
		}
		if (this.status === 'error') return `ผิดพลาด: ${this.errorMessage || 'Unknown'}`;
		return 'รอบันทึก';
	}


	async setFileHandle(handle: DiagramFileHandle | null): Promise<boolean> {
		const diagramId = _session?.activeDiagramId;
		if (!diagramId) {
			console.warn('Cannot set file handle: no active diagram');
			return false;
		}

		if (handle) {
			this.fileHandles.set(diagramId, handle);
			this.updateFileHandle();
			this.status = 'idle';
			this.errorMessage = null;

			this.persistHandles();

			return await this.saveNow();
		} else {
			this.fileHandles.delete(diagramId);
			this.updateFileHandle();
			this.persistHandles();
		}
		return true;
	}


	onDiagramSwitch() {
		const diagramId = _session?.activeDiagramId ?? null;


		if (diagramId !== this.lastDiagramId) {
			this.stop();
			this.updateFileHandle();
			this.status = 'idle';
			this.lastSaveTime = null;
			this.errorMessage = null;
			this.lastDiagramState = null;
			this.lastDiagramId = diagramId;


			if (this.enabled && this.fileHandle) {
				this.start();
			}
		}
	}


	private persistHandles() {
		const data: Record<string, { fileName: string; lastSaved: number }> = {};
		for (const [id, handle] of this.fileHandles) {
			data[id] = {
				fileName: handle.fileName,
				lastSaved: handle.lastSaved
			};
		}
		localStorage.setItem('auto-save-handles', JSON.stringify(data));
	}


	loadPersistedHandles() {
		try {
			const raw = localStorage.getItem('auto-save-handles');
			if (raw) {


				const data = JSON.parse(raw);
				// We can show which diagrams had auto-save in the past
				// but cannot restore the actual file handles
			}
		} catch {
			// Ignore errors
		}
	}


	start() {
		if (!this.enabled || !this.fileHandle) return;


		this.stop();


		this.saveTimer = setInterval(() => {
			this.saveIfChanged();
		}, this.interval);
	}


	stop() {
		if (this.saveTimer) {
			clearInterval(this.saveTimer);
			this.saveTimer = null;
		}
	}


	async saveNow(): Promise<boolean> {
		if (!this.fileHandle) {
			this.status = 'error';
			this.errorMessage = 'ไม่มี file handle';
			return false;
		}

		try {

			const hasPermission = await verifyPermission(this.fileHandle.handle);
			if (!hasPermission) {
				this.status = 'error';
				this.errorMessage = 'ไม่มีสิทธิ์เขียนไฟล์';
				return false;
			}

			this.status = 'saving';
			this.errorMessage = null;


			const data = this.getDiagramData();


			await writeToFile(this.fileHandle, data);


			this.lastDiagramState = this.contentState(data);
			this.markFileSaved(data);
			this.status = 'saved';
			this.lastSaveTime = Date.now();


			if (_collab?.connected) {
				_collab.pushSaveEvent();
			}

			return true;
		} catch (error) {
			console.error('Auto-save error:', error);
			this.status = 'error';
			this.errorMessage = (error as Error).message;
			return false;
		}
	}


	async saveIfChanged(): Promise<void> {
		if (!this.enabled || !this.fileHandle) return;

		const currentState = this.contentState(this.getDiagramData());


		if (currentState === this.lastDiagramState) {
			return;
		}

		await this.saveNow();
	}


	private getDiagramData(): object {
		return {
			version: '1.0',
			diagramType: diagram.diagramType,
			name: _session?.activeDiagramName || 'Untitled',
			entities: diagram.entities,
			relationships: diagram.relationships,
			notes: diagram.notes,
			comments: diagram.comments,
			flowNodes: diagram.flowNodes,
			flowEdges: diagram.flowEdges,
			dfdNodes: diagram.dfdNodes,
			dfdFlows: diagram.dfdFlows,
			notation: diagram.notation,
			showGrid: diagram.showGrid,
			diagramFont: diagram.diagramFont,
			diagramFontSize: diagram.diagramFontSize,
			customFonts: diagram.customFonts,
			panX: diagram.panX,
			panY: diagram.panY,
			zoom: diagram.zoom,
			savedAt: new Date().toISOString()
		};
	}


	toggle() {
		this.enabled = !this.enabled;
		if (this.enabled && this.fileHandle) {
			this.start();
		} else {
			this.stop();
		}
	}


	clear() {
		this.stop();
		const diagramId = _session?.activeDiagramId;
		if (diagramId) {
			this.fileHandles.delete(diagramId);
			this.updateFileHandle();
			this.persistHandles();
		}
		this.status = 'idle';
		this.lastSaveTime = null;
		this.errorMessage = null;
		this.lastDiagramState = null;
	}


	get hasAutoSave(): boolean {
		return this.fileHandle !== null;
	}
}

export const autoSave = new AutoSaveState();


if (typeof window !== 'undefined') {
	autoSave.loadPersistedHandles();
}
