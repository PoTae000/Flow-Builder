/**
 * Auto-save store - manages automatic saving to local file system
 * Supports multiple diagrams with separate file handles per diagram ID
 */

import { diagram } from './diagram.svelte';
import { type DiagramFileHandle, writeToFile, isFileSystemSupported, verifyPermission } from '$lib/utils/file-system';

// Lazy import collab to avoid circular dependency
let _collab: { pushSaveEvent: () => void; connected: boolean } | null = null;
export function registerCollab(c: typeof _collab) {
	_collab = c;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// Lazy import session to avoid circular dependency
let _session: { activeDiagramId: string | null } | null = null;
export function registerSession(s: typeof _session) {
	_session = s;
}

class AutoSaveState {
	// File handles per diagram ID
	private fileHandles = $state<Map<string, DiagramFileHandle>>(new Map());

	// Save status
	status = $state<SaveStatus>('idle');
	lastSaveTime = $state<number | null>(null);
	errorMessage = $state<string | null>(null);

	// Auto-save settings
	enabled = $state(true);
	interval = $state(10000); // 10 seconds

	// Internal state
	private saveTimer: ReturnType<typeof setInterval> | null = null;
	private lastDiagramState: string | null = null;
	private lastDiagramId: string | null = null;

	// Current file handle (reactive)
	fileHandle = $state<DiagramFileHandle | null>(null);

	// Update fileHandle when diagram switches
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

	/**
	 * Set file handle for current diagram
	 */
	setFileHandle(handle: DiagramFileHandle | null) {
		const diagramId = _session?.activeDiagramId;
		if (!diagramId) {
			console.warn('Cannot set file handle: no active diagram');
			return;
		}

		if (handle) {
			this.fileHandles.set(diagramId, handle);
			this.updateFileHandle(); // Update reactive state
			this.status = 'idle';
			this.errorMessage = null;
			// Persist to localStorage
			this.persistHandles();
			// Trigger immediate save
			this.saveNow();
		} else {
			this.fileHandles.delete(diagramId);
			this.updateFileHandle(); // Update reactive state
			this.persistHandles();
		}
	}

	/**
	 * Called when diagram switches - reset state and start timer if needed
	 */
	onDiagramSwitch() {
		const diagramId = _session?.activeDiagramId;

		// If diagram changed, reset state
		if (diagramId !== this.lastDiagramId) {
			this.stop();
			this.updateFileHandle(); // Update reactive state for new diagram
			this.status = 'idle';
			this.lastSaveTime = null;
			this.errorMessage = null;
			this.lastDiagramState = null;
			this.lastDiagramId = diagramId;

			// Start timer if enabled and has handle
			if (this.enabled && this.fileHandle) {
				this.start();
			}
		}
	}

	/**
	 * Persist file handles to localStorage (only file paths, not handles themselves)
	 */
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

	/**
	 * Load persisted handles from localStorage
	 * Note: Cannot restore actual FileSystemFileHandle across sessions,
	 * so we only track which diagrams had auto-save enabled
	 */
	loadPersistedHandles() {
		try {
			const raw = localStorage.getItem('auto-save-handles');
			if (raw) {
				// Just to show indicator that auto-save was previously configured
				// User will need to re-select file on next save attempt
				const data = JSON.parse(raw);
				// We can show which diagrams had auto-save in the past
				// but cannot restore the actual file handles
			}
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Start auto-save timer
	 */
	start() {
		if (!this.enabled || !this.fileHandle) return;

		// Clear existing timer
		this.stop();

		// Set up periodic save
		this.saveTimer = setInterval(() => {
			this.saveIfChanged();
		}, this.interval);
	}

	/**
	 * Stop auto-save timer
	 */
	stop() {
		if (this.saveTimer) {
			clearInterval(this.saveTimer);
			this.saveTimer = null;
		}
	}

	/**
	 * Save diagram data now
	 */
	async saveNow(): Promise<boolean> {
		if (!this.fileHandle) {
			this.status = 'error';
			this.errorMessage = 'ไม่มี file handle';
			return false;
		}

		try {
			// Verify permission
			const hasPermission = await verifyPermission(this.fileHandle.handle);
			if (!hasPermission) {
				this.status = 'error';
				this.errorMessage = 'ไม่มีสิทธิ์เขียนไฟล์';
				return false;
			}

			this.status = 'saving';
			this.errorMessage = null;

			// Get current diagram state
			const data = this.getDiagramData();

			// Write to file
			await writeToFile(this.fileHandle, data);

			// Update state
			this.lastDiagramState = JSON.stringify(data);
			this.status = 'saved';
			this.lastSaveTime = Date.now();

			// Broadcast save event to collaboration room
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

	/**
	 * Save only if diagram has changed
	 */
	async saveIfChanged(): Promise<void> {
		if (!this.enabled || !this.fileHandle) return;

		const currentState = JSON.stringify(this.getDiagramData());

		// Skip if no changes
		if (currentState === this.lastDiagramState) {
			return;
		}

		await this.saveNow();
	}

	/**
	 * Get current diagram data for saving
	 */
	private getDiagramData(): object {
		return {
			version: '1.0',
			diagramType: diagram.diagramType,
			name: diagram.diagramName || 'Untitled',
			entities: diagram.entities,
			relationships: diagram.relationships,
			flowNodes: diagram.flowNodes,
			flowEdges: diagram.flowEdges,
			dfdNodes: diagram.dfdNodes,
			dfdFlows: diagram.dfdFlows,
			notation: diagram.notation,
			showGrid: diagram.showGrid,
			diagramFont: diagram.diagramFont,
			customFonts: diagram.customFonts,
			panX: diagram.panX,
			panY: diagram.panY,
			zoom: diagram.zoom,
			savedAt: new Date().toISOString()
		};
	}

	/**
	 * Toggle auto-save on/off
	 */
	toggle() {
		this.enabled = !this.enabled;
		if (this.enabled && this.fileHandle) {
			this.start();
		} else {
			this.stop();
		}
	}

	/**
	 * Clear file handle for current diagram (unlink from file)
	 */
	clear() {
		this.stop();
		const diagramId = _session?.activeDiagramId;
		if (diagramId) {
			this.fileHandles.delete(diagramId);
			this.updateFileHandle(); // Update reactive state
			this.persistHandles();
		}
		this.status = 'idle';
		this.lastSaveTime = null;
		this.errorMessage = null;
		this.lastDiagramState = null;
	}

	/**
	 * Check if current diagram has auto-save configured
	 */
	get hasAutoSave(): boolean {
		return this.fileHandle !== null;
	}
}

export const autoSave = new AutoSaveState();

// Initialize persisted handles on import
if (typeof window !== 'undefined') {
	autoSave.loadPersistedHandles();
}
