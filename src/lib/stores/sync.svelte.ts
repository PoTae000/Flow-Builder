import type { DiagramMeta, DiagramData, VersionMeta } from '$lib/types/session';
import { auth } from '$lib/stores/auth.svelte';
import { enqueue, dequeueAll, clearQueue, getQueueSize } from '$lib/stores/offline-queue';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

class SyncState {
	status = $state<SyncStatus>('idle');
	lastError = $state<string | null>(null);

	private pushTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingPush: { meta: DiagramMeta; data: DiagramData }[] = [];
	private syncedTimer: ReturnType<typeof setTimeout> | null = null;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private lastPushTime = 0;
	private pollTrigger: (() => void) | null = null;
	private canPollFn: (() => boolean) | null = null;

	// Token refresh lock to prevent concurrent refreshes
	private refreshPromise: Promise<void> | null = null;

	// Version-based polling state
	private lastKnownVersion = 0;
	private lastPushedVersion = 0;
	private fullSyncInFlight = false;
	/** Consecutive error count — stops all sync after 2 failures */
	private errorCount = 0;
	private static MAX_ERRORS = 2;

	/** Check if an error is fatal (auth or quota — no point retrying) */
	private isFatalSyncError(err: unknown): boolean {
		if (err instanceof Error) {
			const msg = err.message.toLowerCase();
			return (
				msg.includes('token expired') ||
				msg.includes('no auth token') ||
				msg.includes('sign in') ||
				msg.includes('limit exceeded')
			);
		}
		return false;
	}

	/** Get user-friendly message for fatal errors */
	private getFatalErrorMessage(err: unknown): string {
		if (err instanceof Error) {
			const msg = err.message.toLowerCase();
			if (msg.includes('token expired') || msg.includes('no auth token') || msg.includes('sign in')) {
				return 'Session expired — please sign in again / เซสชันหมดอายุ กรุณา Sign in ใหม่';
			}
			if (msg.includes('limit exceeded')) {
				return 'Storage quota reached — try again tomorrow / พื้นที่เต็ม ลองใหม่พรุ่งนี้';
			}
		}
		return 'Sync failed / ซิงค์ไม่สำเร็จ';
	}

	/** Immediately pause sync due to fatal error */
	private handleFatalError(err: unknown) {
		console.warn('[sync] fatal error, sync paused:', err);
		this.errorCount = SyncState.MAX_ERRORS;
		this.status = 'error';
		this.lastError = this.getFatalErrorMessage(err);
		this.stopPolling();
	}

	/** True when sync has been paused due to too many consecutive errors */
	get isPaused(): boolean {
		return this.errorCount >= SyncState.MAX_ERRORS;
	}

	/**
	 * Manual "Sync now": flush any pending push, then pull latest from cloud.
	 * Used by the Sync button so the user can force an immediate sync without
	 * waiting for the idle debounce or the poll interval.
	 */
	async syncNow(): Promise<void> {
		if (!this.canSync) return;
		// Clear a paused state so a manual tap always tries again
		if (this.errorCount >= SyncState.MAX_ERRORS) {
			this.errorCount = 0;
			this.status = 'idle';
			this.lastError = null;
		}
		await this.flushNow();
		if (this.pollTrigger) this.pollTrigger();
	}

	/** Retry sync after it has been paused due to errors */
	retrySync() {
		this.errorCount = 0;
		this.status = 'idle';
		this.lastError = null;
		// Restart polling if we have a trigger
		if (this.pollTrigger && this.canPollFn) {
			this.startPolling(this.pollTrigger, this.canPollFn);
		}
		// Trigger a full sync immediately
		if (this.pollTrigger) {
			this.pollTrigger();
		}
	}

	private getToken(): string | null {
		try {
			return sessionStorage.getItem('er-diagram:id-token');
		} catch {
			return null;
		}
	}

	get canSync(): boolean {
		return auth.isSignedIn && !!this.getToken();
	}

	/** True if there's a pending push waiting to be flushed. */
	get hasPendingPush(): boolean {
		return this.pushTimer !== null || this.pendingPush.length > 0;
	}

	private async fetchApi(path: string, init?: RequestInit): Promise<Response> {
		// Check token validity before making request; try refresh if expired
		const { isTokenValid, refreshToken } = await import('$lib/utils/google-auth');
		if (!isTokenValid()) {
			// Use lock to prevent concurrent refresh attempts
			if (!this.refreshPromise) {
				this.refreshPromise = refreshToken().finally(() => { this.refreshPromise = null; });
			}
			try {
				await this.refreshPromise;
			} catch {
				throw new Error('Token expired - please sign in again');
			}
		}

		const token = this.getToken();
		if (!token) throw new Error('No auth token');

		const res = await fetch(path, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				...init?.headers
			}
		});

		// If 401 despite pre-check, attempt one more refresh + retry
		if (res.status === 401) {
			try {
				await refreshToken();
			} catch {
				throw new Error('Token expired - please sign in again');
			}
			const newToken = this.getToken();
			if (!newToken) throw new Error('No auth token after refresh');

			const retryRes = await fetch(path, {
				...init,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${newToken}`,
					...init?.headers
				}
			});
			if (!retryRes.ok) {
				const text = await retryRes.text().catch(() => '');
				throw new Error(`API ${retryRes.status}: ${text}`);
			}
			return retryRes;
		}

		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`API ${res.status}: ${text}`);
		}

		return res;
	}

	/**
	 * Lightweight version check — 1 KV read, ~30 bytes response.
	 * Returns the cloud version number.
	 */
	private async checkVersion(): Promise<number> {
		const res = await this.fetchApi('/api/sync/version');
		const data = (await res.json()) as { version: number };
		return data.version;
	}

	/**
	 * Full sync: pull cloud → compare updatedAt → apply newer data.
	 * Callbacks let session.svelte.ts handle actual localStorage ops.
	 */
	async fullSync(
		localMetas: DiagramMeta[],
		localActive: string | null,
		getLocalData: (id: string) => DiagramData | null,
		applyCloudDiagram: (meta: DiagramMeta, data: DiagramData) => void,
		applyCloudActive: (id: string) => void,
		setMetas: (metas: DiagramMeta[]) => void,
		knownCloudIds: Set<string>,
		deleteLocalDiagram: (id: string) => void
	) {
		if (!this.canSync) return;
		if (this.fullSyncInFlight) return;
		if (this.errorCount >= SyncState.MAX_ERRORS) return;

		this.fullSyncInFlight = true;

		// Flush any pending push first so cloud has our latest data before we pull
		if (this.pendingPush.length > 0) {
			await this.flushPush();
		}

		// If flushPush failed and paused sync, abort fullSync
		if (this.errorCount >= SyncState.MAX_ERRORS) {
			this.fullSyncInFlight = false;
			return;
		}

		this.status = 'syncing';
		this.lastError = null;

		try {
			// 1. Pull cloud meta list
			const res = await this.fetchApi('/api/sync/diagrams');
			const cloud = (await res.json()) as {
				diagrams: DiagramMeta[];
				active: string | null;
				deleted?: { id: string; deletedAt: number }[];
			};

			const cloudMap = new Map(cloud.diagrams.map((m) => [m.id, m]));
			const localMap = new Map(localMetas.map((m) => [m.id, m]));
			// Server-authoritative tombstones: id → when it was deleted.
			const tombstones = new Map((cloud.deleted ?? []).map((d) => [d.id, d.deletedAt]));

			// 2. Find diagrams that need to be pulled from cloud (cloud is newer)
			const pullIds: string[] = [];
			const mergedMetas = new Map<string, DiagramMeta>();

			// Process cloud diagrams
			for (const [id, cloudMeta] of cloudMap) {
				const localMeta = localMap.get(id);
				if (!localMeta || cloudMeta.updatedAt > localMeta.updatedAt) {
					// Cloud is newer — pull data
					pullIds.push(id);
					mergedMetas.set(id, cloudMeta);
				} else {
					// Local is newer or same — keep local
					mergedMetas.set(id, localMeta);
				}
			}

			// Process local-only diagrams (not in cloud). Decide push-vs-delete
			// from the server tombstone list, NOT a per-device heuristic — that
			// heuristic was resurrecting diagrams deleted on another device.
			const pushItems: { meta: DiagramMeta; data: DiagramData }[] = [];
			const remoteDeletedIds: string[] = [];
			for (const [id, localMeta] of localMap) {
				if (!cloudMap.has(id)) {
					const tombstonedAt = tombstones.get(id);
					if (tombstonedAt !== undefined && localMeta.updatedAt <= tombstonedAt) {
						// Deleted on another device and we haven't edited it since →
						// delete locally too.
						remoteDeletedIds.push(id);
					} else if (knownCloudIds.has(id) && tombstonedAt === undefined) {
						// Was in cloud before, gone now, and no tombstone visible yet
						// (defensive: e.g. tombstone list unavailable) → treat as
						// remote delete rather than risk a resurrection loop.
						remoteDeletedIds.push(id);
					} else {
						// New locally, or re-edited after a deletion → push to cloud.
						mergedMetas.set(id, localMeta);
						const data = getLocalData(id);
						if (data) {
							pushItems.push({ meta: localMeta, data });
						}
					}
				}
			}

			// Apply remote deletions
			for (const id of remoteDeletedIds) {
				deleteLocalDiagram(id);
			}

			// 3. Pull newer cloud diagram data
			if (pullIds.length > 0) {
				const pullRes = await this.fetchApi('/api/sync/pull', {
					method: 'POST',
					body: JSON.stringify({ ids: pullIds })
				});
				const pullData = (await pullRes.json()) as {
					diagrams: Record<string, DiagramData>;
				};

				for (const id of pullIds) {
					const data = pullData.diagrams[id];
					const meta = cloudMap.get(id);
					if (data && meta) {
						applyCloudDiagram(meta, data);
					}
				}
			}

			// 4. Push local-only diagrams to cloud
			if (pushItems.length > 0) {
				const pushRes = await this.fetchApi('/api/sync/push', {
					method: 'POST',
					body: JSON.stringify({
						diagrams: pushItems,
						active: localActive
					})
				});
				const pushData = (await pushRes.json()) as { version?: number };
				if (pushData.version) {
					this.lastPushedVersion = pushData.version;
					this.lastKnownVersion = pushData.version;
				}
			}

			// 5. Also push local-newer diagrams to cloud
			const localNewerPush: { meta: DiagramMeta; data: DiagramData }[] = [];
			for (const [id, localMeta] of localMap) {
				const cloudMeta = cloudMap.get(id);
				if (cloudMeta && localMeta.updatedAt > cloudMeta.updatedAt) {
					const data = getLocalData(id);
					if (data) {
						localNewerPush.push({ meta: localMeta, data });
					}
				}
			}
			if (localNewerPush.length > 0) {
				const pushRes = await this.fetchApi('/api/sync/push', {
					method: 'POST',
					body: JSON.stringify({
						diagrams: localNewerPush,
						active: localActive
					})
				});
				const pushData = (await pushRes.json()) as { version?: number };
				if (pushData.version) {
					this.lastPushedVersion = pushData.version;
					this.lastKnownVersion = pushData.version;
				}
			}

			// 6. Update local meta list with merged result
			const finalMetas = Array.from(mergedMetas.values()).sort(
				(a, b) => a.createdAt - b.createdAt
			);
			setMetas(finalMetas);

			// 7. Update known cloud IDs for next sync (to detect remote deletions)
			knownCloudIds.clear();
			for (const id of mergedMetas.keys()) {
				knownCloudIds.add(id);
			}

			// 8. Apply cloud active diagram if local has none
			if (!localActive && cloud.active && mergedMetas.has(cloud.active)) {
				applyCloudActive(cloud.active);
			}

			// 8. Update lastKnownVersion from cloud
			try {
				const currentVersion = await this.checkVersion();
				this.lastKnownVersion = currentVersion;
			} catch {
				// non-critical
			}

			this.errorCount = 0;
			this.showSynced();
		} catch (err) {
			if (this.isFatalSyncError(err)) {
				this.handleFatalError(err);
			} else {
				this.errorCount++;
				console.warn(`[sync] fullSync failed (${this.errorCount}/${SyncState.MAX_ERRORS}):`, err);
				this.status = 'error';
				this.lastError = err instanceof Error ? err.message : 'Sync failed';
				if (this.errorCount >= SyncState.MAX_ERRORS) {
					console.warn('[sync] too many errors, sync paused');
					this.stopPolling();
				}
			}
		} finally {
			this.fullSyncInFlight = false;
		}
	}

	/**
	 * Schedule a debounced push to cloud after local save.
	 * When offline, queues to IndexedDB instead.
	 */
	schedulePush(meta: DiagramMeta, data: DiagramData) {
		if (!this.canSync || this.errorCount >= SyncState.MAX_ERRORS) return;

		// Offline: queue to IndexedDB
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			enqueue({ operation: 'push', diagramId: meta.id, data, meta, timestamp: Date.now() });
			return;
		}

		// Replace any existing pending push for this diagram
		const idx = this.pendingPush.findIndex((p) => p.meta.id === meta.id);
		if (idx >= 0) {
			this.pendingPush[idx] = { meta, data };
		} else {
			this.pendingPush.push({ meta, data });
		}

		if (this.pushTimer) clearTimeout(this.pushTimer);
		this.pushTimer = setTimeout(() => {
			this.pushTimer = null;
			this.flushPush();
		}, 3_000);
	}

	/**
	 * Immediately flush any pending push. Call on tab hide / unload / device
	 * switch so cloud has the latest data before timers get frozen (mobile
	 * backgrounding suspends setTimeout, which otherwise drops the pending push).
	 */
	async flushNow(): Promise<void> {
		if (this.pushTimer) {
			clearTimeout(this.pushTimer);
			this.pushTimer = null;
		}
		if (this.pendingPush.length > 0) {
			await this.flushPush();
		}
	}

	private async flushPush() {
		if (this.pendingPush.length === 0) return;
		if (this.errorCount >= SyncState.MAX_ERRORS) return;

		const items = [...this.pendingPush];
		this.pendingPush = [];

		this.status = 'syncing';
		try {
			const res = await this.fetchApi('/api/sync/push', {
				method: 'POST',
				body: JSON.stringify({ diagrams: items })
			});
			const data = (await res.json()) as { version?: number };
			if (data.version) {
				this.lastPushedVersion = data.version;
				this.lastKnownVersion = data.version;
			}
			this.lastPushTime = Date.now();
			this.errorCount = 0;
			this.showSynced();
		} catch (err) {
			if (this.isFatalSyncError(err)) {
				this.handleFatalError(err);
			} else {
				this.errorCount++;
				console.warn(`[sync] push failed (${this.errorCount}/${SyncState.MAX_ERRORS}):`, err);
				this.status = 'error';
				this.lastError = err instanceof Error ? err.message : 'Push failed';
				if (this.errorCount >= SyncState.MAX_ERRORS) {
					console.warn('[sync] too many errors, sync paused');
					this.stopPolling();
				}
			}
		}
	}

	/**
	 * Delete a diagram from cloud.
	 * When offline, queues to IndexedDB.
	 */
	async pushDelete(id: string) {
		if (!this.canSync) return;

		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			await enqueue({ operation: 'delete', diagramId: id, timestamp: Date.now() });
			return;
		}

		try {
			const res = await this.fetchApi(`/api/sync/diagram/${id}`, { method: 'DELETE' });
			const data = (await res.json()) as { version?: number };
			if (data.version) {
				this.lastPushedVersion = data.version;
				this.lastKnownVersion = data.version;
			}
		} catch (err) {
			console.warn('[sync] delete failed:', err);
		}
	}

	/**
	 * Push updated active diagram ID to cloud.
	 * When offline, queues to IndexedDB.
	 */
	async pushActive(id: string) {
		if (!this.canSync) return;

		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			await enqueue({ operation: 'active', diagramId: id, timestamp: Date.now() });
			return;
		}

		try {
			const res = await this.fetchApi('/api/sync/push', {
				method: 'POST',
				body: JSON.stringify({ diagrams: [], active: id })
			});
			const data = (await res.json()) as { version?: number };
			if (data.version) {
				this.lastPushedVersion = data.version;
				this.lastKnownVersion = data.version;
			}
		} catch {
			// non-critical
		}
	}

	private showSynced() {
		this.status = 'synced';
		if (this.syncedTimer) clearTimeout(this.syncedTimer);
		this.syncedTimer = setTimeout(() => {
			if (this.status === 'synced') this.status = 'idle';
			this.syncedTimer = null;
		}, 3000);
	}

	/**
	 * Start periodic version polling for cloud sync.
	 * Polls lightweight /api/sync/version every 5s (near-realtime).
	 * Only triggers full sync when version changes AND isn't our own push.
	 */
	startPolling(triggerSync: () => void, canPoll: () => boolean, interval = 5_000) {
		this.pollTrigger = triggerSync;
		this.canPollFn = canPoll;
		this.stopPolling();
		this.pollTimer = setInterval(() => {
			this.pollVersionCheck();
		}, interval);
	}

	private async pollVersionCheck() {
		// Skip if not signed in or no trigger
		if (!this.canSync || !this.pollTrigger) return;
		// Skip if there are unsaved local edits or pending pushes
		if (this.hasPendingPush || (this.canPollFn && !this.canPollFn())) return;
		// Skip if full sync already in flight
		if (this.fullSyncInFlight) return;

		try {
			const cloudVersion = await this.checkVersion();

			// No change — nothing to do
			if (cloudVersion === this.lastKnownVersion) return;

			// Version changed but it's our own push — just update tracker
			if (cloudVersion === this.lastPushedVersion) {
				this.lastKnownVersion = cloudVersion;
				return;
			}

			// Someone else changed the cloud — trigger full sync
			this.lastKnownVersion = cloudVersion;
			this.pollTrigger();
		} catch {
			// Network error during version check — ignore, retry next poll
		}
	}

	stopPolling() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	// --- Cloud Version History ---

	async fetchVersions(diagramId: string): Promise<VersionMeta[]> {
		if (!this.canSync) return [];
		try {
			const res = await this.fetchApi(`/api/sync/diagram/${diagramId}/versions`);
			const data = (await res.json()) as { versions: VersionMeta[] };
			return data.versions;
		} catch (err) {
			console.warn('[sync] fetchVersions failed:', err);
			return [];
		}
	}

	async fetchVersionData(diagramId: string, versionId: number): Promise<DiagramData | null> {
		if (!this.canSync) return null;
		try {
			const res = await this.fetchApi(`/api/sync/diagram/${diagramId}/versions/${versionId}`);
			const data = (await res.json()) as { data: DiagramData };
			return data.data;
		} catch (err) {
			console.warn('[sync] fetchVersionData failed:', err);
			return null;
		}
	}

	async restoreVersion(diagramId: string, versionId: number): Promise<{ data: DiagramData; name: string; diagramType: string } | null> {
		if (!this.canSync) return null;
		try {
			const res = await this.fetchApi(`/api/sync/diagram/${diagramId}/versions/${versionId}`, {
				method: 'POST'
			});
			const result = (await res.json()) as { data: DiagramData; name: string; diagramType: string; version?: number };
			if (result.version) {
				this.lastPushedVersion = result.version;
				this.lastKnownVersion = result.version;
			}
			return { data: result.data, name: result.name, diagramType: result.diagramType };
		} catch (err) {
			console.warn('[sync] restoreVersion failed:', err);
			return null;
		}
	}

	// --- Offline Queue Drain ---

	async drainQueue(): Promise<void> {
		if (!this.canSync) return;
		const entries = await dequeueAll();
		if (entries.length === 0) return;

		for (const entry of entries) {
			try {
				if (entry.operation === 'push' && entry.data && entry.meta) {
					await this.fetchApi('/api/sync/push', {
						method: 'POST',
						body: JSON.stringify({ diagrams: [{ meta: entry.meta, data: entry.data }] })
					});
				} else if (entry.operation === 'delete') {
					await this.fetchApi(`/api/sync/diagram/${entry.diagramId}`, { method: 'DELETE' });
				} else if (entry.operation === 'active') {
					await this.fetchApi('/api/sync/push', {
						method: 'POST',
						body: JSON.stringify({ diagrams: [], active: entry.diagramId })
					});
				}
			} catch (err) {
				console.warn('[sync] drainQueue entry failed:', err);
			}
		}
		await clearQueue();
	}

	reset() {
		this.status = 'idle';
		this.lastError = null;
		this.pendingPush = [];
		this.lastKnownVersion = 0;
		this.lastPushedVersion = 0;
		this.fullSyncInFlight = false;
		this.errorCount = 0;
		this.stopPolling();
		this.pollTrigger = null;
		this.canPollFn = null;
		if (this.pushTimer) {
			clearTimeout(this.pushTimer);
			this.pushTimer = null;
		}
		if (this.syncedTimer) {
			clearTimeout(this.syncedTimer);
			this.syncedTimer = null;
		}
	}
}

export const sync = new SyncState();
