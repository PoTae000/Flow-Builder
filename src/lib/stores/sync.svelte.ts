import type { DiagramMeta, DiagramData, VersionMeta } from '$lib/types/session';
import { auth } from '$lib/stores/auth.svelte';
import { enqueue, dequeueAll, clearQueue, getQueueSize } from '$lib/stores/offline-queue';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

class SyncState {
	status = $state<SyncStatus>('idle');
	lastError = $state<string | null>(null);

	
	kickedBy = $state<string | null>(null);
	
	private kickingInProgress = false;

	private pushTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingPush: { meta: DiagramMeta; data: DiagramData }[] = [];
	private syncedTimer: ReturnType<typeof setTimeout> | null = null;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private lastPushTime = 0;
	private pollTrigger: (() => void) | null = null;
	private canPollFn: (() => boolean) | null = null;

	
	
	private eventSource: EventSource | null = null;
	
	private connId: string | null = null;
	
	private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private sseReconnectDelay = 1_000;

	
	private refreshPromise: Promise<void> | null = null;

	
	private lastKnownVersion = 0;
	private lastPushedVersion = 0;
	private fullSyncInFlight = false;
	
	private errorCount = 0;
	private static MAX_ERRORS = 6;

	
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

	
	private handleFatalError(err: unknown) {
		console.warn('[sync] fatal error, sync paused:', err);
		this.errorCount = SyncState.MAX_ERRORS;
		this.status = 'error';
		this.lastError = this.getFatalErrorMessage(err);
		this.stopPolling();
	}

	
	get isPaused(): boolean {
		return this.errorCount >= SyncState.MAX_ERRORS;
	}

	
	async syncNow(): Promise<void> {
		if (!this.canSync) return;
		
		if (this.errorCount >= SyncState.MAX_ERRORS) {
			this.errorCount = 0;
			this.status = 'idle';
			this.lastError = null;
		}
		await this.flushNow();
		if (this.pollTrigger) this.pollTrigger();
	}

	
	retrySync() {
		this.errorCount = 0;
		this.status = 'idle';
		this.lastError = null;
		
		if (this.pollTrigger && this.canPollFn) {
			this.startPolling(this.pollTrigger, this.canPollFn);
		}
		
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

	
	private deviceId(): string {
		if (this.connId) return this.connId;
		let id: string | null = null;
		try {
			id = localStorage.getItem('er-diagram:device-id');
		} catch { /* private mode — fall through */ }
		if (!id) {
			id =
				typeof crypto !== 'undefined' && crypto.randomUUID
					? crypto.randomUUID()
					: `d-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
			try {
				localStorage.setItem('er-diagram:device-id', id);
			} catch { /* private mode — id lives only in memory this session */ }
		}
		this.connId = id;
		return id;
	}

	
	async claimDevice(): Promise<void> {
		if (!this.canSync) return;
		try {
			await this.fetchApi('/api/sync/claim', {
				method: 'POST',
				body: JSON.stringify({ deviceId: this.deviceId(), label: this.deviceLabel() })
			});
			
			this.kickedBy = null;
		} catch (err) {
			
			
			console.warn('[sync] claimDevice failed:', err);
		}
	}

	get canSync(): boolean {
		
		
		if (this.kickedBy) return false;
		return auth.isSignedIn && !!this.getToken();
	}

	
	get hasPendingPush(): boolean {
		return this.pushTimer !== null || this.pendingPush.length > 0;
	}

	private async fetchApi(path: string, init?: RequestInit): Promise<Response> {
		
		const { isTokenValid, refreshToken } = await import('$lib/utils/google-auth');
		if (!isTokenValid()) {
			
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

	
	private async checkVersion(): Promise<number> {
		const res = await this.fetchApi('/api/sync/version');
		const data = (await res.json()) as { version: number };
		return data.version;
	}

	
	private async checkVersionAndDevice(): Promise<{
		version: number;
		activeDevice: string | null;
		activeDeviceLabel: string | null;
	}> {
		const res = await this.fetchApi('/api/sync/version');
		const data = (await res.json()) as {
			version: number;
			activeDevice?: string | null;
			activeDeviceLabel?: string | null;
		};
		return {
			version: data.version,
			activeDevice: data.activeDevice ?? null,
			activeDeviceLabel: data.activeDeviceLabel ?? null
		};
	}

	
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

		
		if (this.pendingPush.length > 0) {
			await this.flushPush();
		}

		
		if (this.errorCount >= SyncState.MAX_ERRORS) {
			this.fullSyncInFlight = false;
			return;
		}

		this.status = 'syncing';
		this.lastError = null;

		try {
			
			const res = await this.fetchApi('/api/sync/diagrams');
			const cloud = (await res.json()) as {
				diagrams: DiagramMeta[];
				active: string | null;
				deleted?: { id: string; deletedAt: number }[];
			};

			const cloudMap = new Map(cloud.diagrams.map((m) => [m.id, m]));
			const localMap = new Map(localMetas.map((m) => [m.id, m]));
			
			const tombstones = new Map((cloud.deleted ?? []).map((d) => [d.id, d.deletedAt]));

			
			const pullIds: string[] = [];
			const mergedMetas = new Map<string, DiagramMeta>();

			
			for (const [id, cloudMeta] of cloudMap) {
				const localMeta = localMap.get(id);
				if (!localMeta || cloudMeta.updatedAt > localMeta.updatedAt) {
					
					pullIds.push(id);
					mergedMetas.set(id, cloudMeta);
				} else {
					
					mergedMetas.set(id, localMeta);
				}
			}

			
			
			
			const pushItems: { meta: DiagramMeta; data: DiagramData }[] = [];
			const remoteDeletedIds: string[] = [];
			for (const [id, localMeta] of localMap) {
				if (!cloudMap.has(id)) {
					const tombstonedAt = tombstones.get(id);
					if (tombstonedAt !== undefined && localMeta.updatedAt <= tombstonedAt) {
						
						
						remoteDeletedIds.push(id);
					} else if (knownCloudIds.has(id) && tombstonedAt === undefined) {
						
						
						
						remoteDeletedIds.push(id);
					} else {
						
						mergedMetas.set(id, localMeta);
						const data = getLocalData(id);
						if (data) {
							pushItems.push({ meta: localMeta, data });
						}
					}
				}
			}

			
			for (const id of remoteDeletedIds) {
				deleteLocalDiagram(id);
			}

			
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

			
			if (pushItems.length > 0) {
				const pushRes = await this.fetchApi('/api/sync/push', {
					method: 'POST',
					body: JSON.stringify({
						diagrams: pushItems,
						active: localActive,
						cid: this.deviceId()
					})
				});
				const pushData = (await pushRes.json()) as { version?: number };
				if (pushData.version) {
					this.lastPushedVersion = pushData.version;
					this.lastKnownVersion = pushData.version;
				}
			}

			
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
						active: localActive,
						cid: this.deviceId()
					})
				});
				const pushData = (await pushRes.json()) as { version?: number };
				if (pushData.version) {
					this.lastPushedVersion = pushData.version;
					this.lastKnownVersion = pushData.version;
				}
			}

			
			const finalMetas = Array.from(mergedMetas.values()).sort(
				(a, b) => a.createdAt - b.createdAt
			);
			setMetas(finalMetas);

			
			knownCloudIds.clear();
			for (const id of mergedMetas.keys()) {
				knownCloudIds.add(id);
			}

			
			if (!localActive && cloud.active && mergedMetas.has(cloud.active)) {
				applyCloudActive(cloud.active);
			}

			
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

	
	schedulePush(meta: DiagramMeta, data: DiagramData) {
		if (!this.canSync || this.errorCount >= SyncState.MAX_ERRORS) return;

		
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			enqueue({ operation: 'push', diagramId: meta.id, data, meta, timestamp: Date.now() });
			return;
		}

		
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
		}, 1_000);
	}

	
	async pushNow(meta: DiagramMeta, data: DiagramData): Promise<void> {
		if (!this.canSync || this.errorCount >= SyncState.MAX_ERRORS) return;

		
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			enqueue({ operation: 'push', diagramId: meta.id, data, meta, timestamp: Date.now() });
			return;
		}

		
		const idx = this.pendingPush.findIndex((p) => p.meta.id === meta.id);
		if (idx >= 0) this.pendingPush.splice(idx, 1);

		this.status = 'syncing';
		try {
			const res = await this.fetchApi('/api/sync/push', {
				method: 'POST',
				body: JSON.stringify({ diagrams: [{ meta, data }], cid: this.deviceId() })
			});
			const d = (await res.json()) as { version?: number };
			if (d.version) {
				this.lastPushedVersion = d.version;
				this.lastKnownVersion = d.version;
			}
			this.lastPushTime = Date.now();
			this.errorCount = 0;
			this.showSynced();
		} catch (err) {
			if (this.isFatalSyncError(err)) {
				this.handleFatalError(err);
			} else {
				this.errorCount++;
				console.warn(`[sync] pushNow failed (${this.errorCount}/${SyncState.MAX_ERRORS}):`, err);
				this.status = 'error';
				this.lastError = err instanceof Error ? err.message : 'Push failed';
				if (this.errorCount >= SyncState.MAX_ERRORS) this.stopPolling();
			}
		}
	}

	
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
				body: JSON.stringify({ diagrams: items, cid: this.deviceId() })
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

	
	startPolling(triggerSync: () => void, canPoll: () => boolean, interval = 2_000) {
		this.pollTrigger = triggerSync;
		this.canPollFn = canPoll;
		this.stopPolling();
		this.pollTimer = setInterval(() => {
			this.pollVersionCheck();
		}, interval);
	}

	private async pollVersionCheck() {
		
		if (!this.canSync || !this.pollTrigger) return;
		
		if (this.fullSyncInFlight) return;

		try {
			const { version: cloudVersion, activeDevice, activeDeviceLabel } =
				await this.checkVersionAndDevice();

			
			
			
			
			if (activeDevice && activeDevice !== this.deviceId()) {
				void this.handleKicked(activeDeviceLabel || 'another device');
				return;
			}

			
			
			if (this.hasPendingPush || (this.canPollFn && !this.canPollFn())) return;

			
			if (cloudVersion === this.lastKnownVersion) return;

			
			if (cloudVersion === this.lastPushedVersion) {
				this.lastKnownVersion = cloudVersion;
				return;
			}

			
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

	
	async startEventStream(triggerSync: () => void) {
		if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
		if (!this.canSync) return;
		if (this.eventSource) return;

		this.pollTrigger = triggerSync;

		
		
		try {
			const { isTokenValid, refreshToken } = await import('$lib/utils/google-auth');
			if (!isTokenValid()) {
				if (!this.refreshPromise) {
					this.refreshPromise = refreshToken().finally(() => { this.refreshPromise = null; });
				}
				await this.refreshPromise;
			}
		} catch {
			
			return;
		}

		
		if (!this.canSync || this.eventSource) return;

		const token = this.getToken();
		if (!token) return;

		
		
		const cid = this.deviceId();
		const device = encodeURIComponent(this.deviceLabel());
		const url = `/api/sync/events?token=${encodeURIComponent(token)}&cid=${encodeURIComponent(cid)}&device=${device}`;
		let es: EventSource;
		try {
			es = new EventSource(url);
		} catch {
			return;
		}
		this.eventSource = es;

		es.addEventListener('open', () => {
			
			this.sseReconnectDelay = 1_000;
			this.kickedBy = null;
		});

		es.addEventListener('changed', () => {
			
			
			if (this.hasPendingPush) return;
			if (this.canPollFn && !this.canPollFn()) return;
			if (this.pollTrigger) this.pollTrigger();
		});

		es.addEventListener('kicked', (e: MessageEvent) => {
			
			
			
			let by = 'another device';
			try {
				by = (JSON.parse(e.data) as { by?: string }).by || by;
			} catch { /* keep default */ }
			void this.handleKicked(by);
		});

		es.addEventListener('error', () => {
			
			if (this.kickedBy) return;
			
			
			this.restartEventStreamWithBackoff();
		});
	}

	
	private deviceLabel(): string {
		if (typeof navigator === 'undefined') return 'a device';
		const ua = navigator.userAgent;
		let os = 'device';
		if (/Android/i.test(ua)) os = 'Android';
		else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
		else if (/Windows/i.test(ua)) os = 'Windows';
		else if (/Mac OS X|Macintosh/i.test(ua)) os = 'Mac';
		else if (/Linux/i.test(ua)) os = 'Linux';
		let browser = 'browser';
		if (/Edg\//i.test(ua)) browser = 'Edge';
		else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
		else if (/Chrome\//i.test(ua)) browser = 'Chrome';
		else if (/Firefox\//i.test(ua)) browser = 'Firefox';
		else if (/Safari\//i.test(ua)) browser = 'Safari';
		return `${browser} on ${os}`;
	}

	
	private preflushHook: (() => void) | null = null;
	registerPreflush(fn: () => void) {
		this.preflushHook = fn;
	}

	
	private async handleKicked(byDeviceLabel: string) {
		
		
		if (this.kickedBy || this.kickingInProgress) return;
		this.kickingInProgress = true;
		try {
			if (this.preflushHook) this.preflushHook();
			await this.flushNow();
		} catch {
			// Best effort — local data is preserved and re-pushes on next sign-in.
		}
		this.stopEventStream();
		this.stopPolling();
		this.kickedBy = byDeviceLabel;
	}

	
	clearKicked() {
		this.kickedBy = null;
		this.kickingInProgress = false;
	}

	private restartEventStreamWithBackoff() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		if (this.sseReconnectTimer) return; 
		const delay = this.sseReconnectDelay;
		this.sseReconnectDelay = Math.min(this.sseReconnectDelay * 2, 30_000);
		this.sseReconnectTimer = setTimeout(() => {
			this.sseReconnectTimer = null;
			if (this.pollTrigger) void this.startEventStream(this.pollTrigger).catch(() => {});
		}, delay);
	}

	stopEventStream() {
		if (this.sseReconnectTimer) {
			clearTimeout(this.sseReconnectTimer);
			this.sseReconnectTimer = null;
		}
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		this.sseReconnectDelay = 1_000;
	}

	

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
		this.stopEventStream();
		this.kickingInProgress = false;
		
		this.connId = null;
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
