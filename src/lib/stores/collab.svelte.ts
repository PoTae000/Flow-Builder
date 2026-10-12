import * as Y from 'yjs';
import { UndoManager } from 'yjs';
// @ts-ignore — y-webrtc has no type declarations
import { WebrtcProvider } from 'y-webrtc';
import { diagram, registerCollab } from './diagram.svelte';
import { auth } from './auth.svelte';
import { PUBLIC_SIGNALING_URL } from '$env/static/public';
import type { Entity, Attribute, Relationship, CardinalityType, Note } from '$lib/types/er';
import type { Comment } from '$lib/types/comment';
import type { NotationStyle } from '$lib/types/notation';
import type { FlowNode, FlowEdge } from '$lib/types/flowchart';
import type { AgentAction } from '$lib/types/agent';
import type { DFDNode, DFDFlow } from '$lib/types/context-diagram';
import { safeSave } from '$lib/utils/storage';
import { snap } from './collab-utils';
import { toast } from './toast.svelte';
import * as permissions from './collab-permissions.svelte';
import * as chat from './collab-chat.svelte';
import { voiceChat } from './voice-chat.svelte';

export interface CollabUser {
	id: number;
	name: string;
	color: string;
	picture: string;
	cursor?: { x: number; y: number };
}

export type PermissionAction = 'import' | 'ai-analysis' | 'translate' | 'auto-layout'
	| 'change-notation' | 'change-font'
	| 'domain-starter' | 'templates' | 'physics' | 'code-to-flow';

export interface PermissionRequest {
	id: string;
	action: PermissionAction;
	requesterClientId: number;
	requesterName: string;
	requesterPicture: string;
	voterClientIds: number[];
	createdAt: number;
}

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	senderName?: string;
	senderPicture?: string;
	action?: {
		actions: AgentAction[];
		diagramType?: string;
		parentId?: string;
		diagramId?: string | null;
		appliedBy?: string;
	};
}

const USER_COLORS = [
	'#f87171', '#fb923c', '#fbbf24', '#a3e635',
	'#34d399', '#22d3ee', '#60a5fa', '#a78bfa',
	'#f472b6', '#e879f9'
];

function generateRandomString(length: number): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars[bytes[i] % chars.length];
	}
	return result;
}

function generateRoomId(): string {
	return generateRandomString(6);
}

function generateRoomToken(): string {
	return generateRandomString(12);
}


let _session: { renameDiagram: (id: string, name: string) => void; activeDiagramId: string | null } | null = null;
export function registerSession(s: typeof _session) {
	_session = s;
}

export class CollabState {
	editLocks = $state<Map<string, { owner: string; name: string; until: number }>>(new Map());
	private lockOwner = '';
	private lockTimer: ReturnType<typeof setInterval> | null = null;
	private lockQueue: Promise<unknown> = Promise.resolve();
	private desiredLocks: string[] = [];
	private transientLocks = new Map<string, number>();
	private newItems = new Set<string>();

	lockLabel(id: string): string | null {
		const lock = this.editLocks.get(id);
		return lock && lock.until > Date.now() && lock.owner !== this.lockOwner ? `${lock.name} กำลังแก้ไขชิ้นนี้` : null;
	}

	canEdit(id: string): boolean {
		if (!this.connected) return true;
		if (this.isViewer) return false;
		if (this.newItems.has(id)) return true;
		const lock = this.editLocks.get(id);
		return !!lock && lock.owner === this.lockOwner && lock.until > Date.now();
	}

	registerNewItem(id: string) {
		// Only the creating synchronous operation may initialize a new item.
		this.newItems.add(id);
		queueMicrotask(() => this.newItems.delete(id));
	}

	private async requestLocks(ids: string[], release = false): Promise<boolean> {
		if (!this.connected || !this.lockOwner) return !this.connected;
		const room = this.roomId, token = this.roomToken, owner = this.lockOwner;
		const started = Date.now();
		try {
			const response = await fetch('/api/collab/locks', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ room, token, owner, name: (this.userName || 'Anonymous').slice(0, 100), ids, release }),
				signal: AbortSignal.timeout(8000)
			});
			if (!response.ok) throw new Error('Lock authority unavailable');
			const data = await response.json();
			if (!this.connected || owner !== this.lockOwner) return false;
			this.editLocks = new Map(data.locks.map((lock: { id: string; owner: string; name: string; expiresAt: string }) => [lock.id, {
				owner: lock.owner === data.self ? owner : lock.owner, name: lock.name,
				until: started + Math.max(0, Date.parse(lock.expiresAt) - data.serverNow - 1000)
			}]));
			this._provider?.awareness.setLocalStateField('editLocks', data.locks);
			return release || ids.every(id => this.canEdit(id));
		} catch {
			if (owner === this.lockOwner) this.editLocks = new Map();
			return false;
		}
	}

	async acquireLocks(ids: string[], notify = true): Promise<boolean> {
		if (!this.connected) return true;
		if (this.isViewer) return false;
		ids = [...new Set(ids)];
		const owner = this.lockOwner;
		const work = this.lockQueue.then(async () => {
			if (!this.connected || owner !== this.lockOwner) return false;
			return ids.every(id => this.canEdit(id)) || this.requestLocks(ids);
		});
		this.lockQueue = work.catch(() => false);
		const granted = await work;
		if (!granted && notify) {
			const label = ids.map(id => this.lockLabel(id)).find(Boolean);
			toast.warning(label || 'ยังไม่สามารถล็อกชิ้นงานได้ กรุณาลองใหม่');
		}
		return granted;
	}

	async runLocked(ids: string[], operation: () => void | Promise<void>) {
		const owner = this.lockOwner;
		ids.forEach(id => this.transientLocks.set(id, (this.transientLocks.get(id) ?? 0) + 1));
		try {
			if (!await this.acquireLocks(ids) || (this.connected && owner !== this.lockOwner)) return false;
			await operation();
			await diagram.waitForEdits();
			return true;
		} finally {
			ids.forEach(id => { const count = (this.transientLocks.get(id) ?? 1) - 1; if (count > 0) this.transientLocks.set(id, count); else this.transientLocks.delete(id); });
			this.releaseUnusedLocks();
		}
	}

	private releaseUnusedLocks() {
		const unused = [...this.editLocks].filter(([id, lock]) => lock.owner === this.lockOwner && !this.desiredLocks.includes(id) && !this.transientLocks.has(id)).map(([id]) => id);
		if (!unused.length) return;
		const next = new Map(this.editLocks);
		unused.forEach(id => next.delete(id));
		this.editLocks = next;
		this.lockQueue = this.lockQueue.then(() => this.requestLocks(unused, true));
	}
	connected = $state(false);
	roomId = $state('');
	roomToken = $state('');
	users = $state<CollabUser[]>([]);
	userName = $state('');
	userPicture = $state('');
	synced = $state(false);
	peerCount = $state(0);

	isHost = $state(false);

	private _joinedAsHost = false;

	private hostClientId: number | null = null;

	private storageListener: ((e: StorageEvent) => void) | null = null;


	permissionRequest = $state<PermissionRequest | null>(null);
	permissionVotes = $state<Map<number, 'approve' | 'deny'>>(new Map());
	localClientId = $state<number>(-1);

	permissionGrants = $state<Map<number, Set<PermissionAction>>>(new Map());
	_permissionResolver: ((result: boolean) => void) | null = null;
	_permissionTimeout: ReturnType<typeof setTimeout> | null = null;


	cursorMap = $state<Map<number, { x: number; y: number; name: string; color: string }>>(new Map());


	remoteSelections = $state<Map<number, { entityIds: string[]; color: string; name: string }>>(new Map());


	get remoteSelectionsByEntity(): Map<string, Array<{ color: string; name: string }>> {
		const result = new Map<string, Array<{ color: string; name: string }>>();
		for (const [, sel] of this.remoteSelections) {
			for (const entityId of sel.entityIds) {
				if (!result.has(entityId)) result.set(entityId, []);
				result.get(entityId)!.push({ color: sel.color, name: sel.name });
			}
		}
		return result;
	}


	chatMessages = $state<ChatMessage[]>([]);
	_suppressChatSync = false;
	_chatBackup: ChatMessage[] = [];



	lastSaveUserName = $state<string | null>(null);
	lastSaveUserPicture = $state<string | null>(null);
	lastSaveTimestamp = $state<number | null>(null);

	_doc: Y.Doc | null = null;
	_provider: WebrtcProvider | null = null;
	_undoManager: UndoManager | null = null;
	suppressLocalPush = false;
	private syncFallbackTimer: ReturnType<typeof setTimeout> | null = null;

	private _conflictToastTimers = new Map<string, number>();

	private _lastLayoutTs = 0;

	private _lastNotationTs = 0;

	private _lastPhysicsTs = 0;

	private _physicsLerpTargets = new Map<string, { x: number; y: number }>();
	private _physicsLerpFrameId = 0;

	private _dragLerpTargets = new Map<string, { x: number; y: number }>();
	private _dragLerpFrameId = 0;

	private _lastDragTs = new Map<number, number>();

	private _emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;


	private _listeners: {
		awarenessChange?: Function;
		awarenessChangeCursors?: Function;
		awarenessChangeLayout?: Function;
		awarenessChangeNotation?: Function;
		awarenessChangePhysics?: Function;
		awarenessChangeDataFlow?: Function;
		awarenessChangeDrag?: Function;
		entitiesObserver?: Function;
		relationshipsObserver?: Function;
		metaObserver?: Function;
		permissionsObserver?: Function;
		chatObserver?: Function;
		notesObserver?: Function;
		commentsObserver?: Function;
		flowNodesObserver?: Function;
		flowEdgesObserver?: Function;
		dfdNodesObserver?: Function;
		dfdFlowsObserver?: Function;
		providerSynced?: Function;
		providerPeers?: Function;
	} = {};


	loadUserName() {
		if (auth.user) {
			this.userName = auth.user.name;
			this.userPicture = auth.user.picture;
		} else if (typeof localStorage !== 'undefined') {
			this.userName = localStorage.getItem('collab-username') || '';
			this.userPicture = '';
		}
	}

	saveUserName() {
		if (typeof localStorage !== 'undefined') {
			safeSave('collab-username', this.userName);
		}
	}


	private saveRoomInfo() {
		if (typeof localStorage !== 'undefined') {
			safeSave('collab-room', JSON.stringify({
				roomId: this.roomId,
				roomToken: this.roomToken,
				isHost: this.isHost
			}));
		}
	}


	private clearRoomInfo() {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem('collab-room');
		}
	}


	tryRejoin(): boolean {
		if (!auth.isSignedIn) return false;
		if (typeof localStorage === 'undefined') return false;
		const raw = localStorage.getItem('collab-room');
		if (!raw) return false;
		try {
			const { roomId, roomToken, isHost } = JSON.parse(raw);
			if (roomId) {

				const token = roomToken || (isHost ? generateRoomToken() : '');
				if (!token) {

					localStorage.removeItem('collab-room');
					return false;
				}
				this.joinRoom(roomId, isHost, token);
				return true;
			}
		} catch { /* ignore */ }
		return false;
	}

	createRoom() {
		if (!auth.isSignedIn) return;
		const id = generateRoomId();
		const token = generateRoomToken();
		this.isHost = true;
		this.joinRoom(id, true, token);
	}

	joinRoom(roomId: string, asHost = false, token?: string) {
		if (!auth.isSignedIn) return;
		this.leaveRoom(true);
		this.roomId = roomId;
		this.roomToken = token || '';
		this.isHost = asHost;
		this._joinedAsHost = asHost;


		if (auth.user) {
			this.userName = auth.user.name;
			this.userPicture = auth.user.picture;
		}


		this.setupStorageListener();

		this._doc = new Y.Doc();








		const signalingServers = PUBLIC_SIGNALING_URL
			? [PUBLIC_SIGNALING_URL]
			: ['wss://signaling.yjs.dev'];


		const topic = this.roomToken
			? `er-diagram-${roomId}-${this.roomToken}`
			: `er-diagram-${roomId}`;
		this._provider = new WebrtcProvider(topic, this._doc, {
			signaling: signalingServers
		});

		this.connected = true;
		this.lockOwner = crypto.randomUUID();
		this.lockTimer = setInterval(() => {
			const ids = [...new Set([...this.desiredLocks, ...this.transientLocks.keys()])].filter(id => !this.lockLabel(id));
			this.lockQueue = this.lockQueue.then(() => this.requestLocks(ids));
		}, 5000);
		this.synced = false;

		const provider = this._provider;


		const colorIdx = Math.floor(Math.random() * USER_COLORS.length);
		const awareness = provider.awareness;
		this.localClientId = awareness.clientID;
		this.hostClientId = asHost ? awareness.clientID : null;

		const userId = auth.user?.sub || '';

		awareness.setLocalStateField('user', {
			name: this.userName || 'Anonymous',
			color: USER_COLORS[colorIdx],
			picture: this.userPicture || '',
			userId: userId
		});


		voiceChat.connect(this._doc, this.localClientId);


		const updateUsers = () => {
			const states = awareness.getStates() as Map<number, { user?: { name: string; color: string; picture: string; userId?: string }; cursor?: { x: number; y: number } | null; selection?: string[]; lastEdit?: { entityId: string; timestamp: number } }>;
			const list: CollabUser[] = [];
			const seenUserIds = new Set<string>();
			const newSelections = new Map<number, { entityIds: string[]; color: string; name: string }>();

			states.forEach((state, clientId) => {
				if (state.user) {

					const userId = (state.user.userId && state.user.userId.trim().length > 0)
						? state.user.userId.trim()
						: `anon-${clientId}`;


					if (seenUserIds.has(userId)) {
						return;
					}
					seenUserIds.add(userId);

					list.push({
						id: clientId,
						name: state.user.name,
						color: state.user.color,
						picture: state.user.picture || '',
						cursor: state.cursor ?? undefined
					});


					if (clientId !== awareness.clientID && state.selection && state.selection.length > 0) {
						newSelections.set(clientId, {
							entityIds: state.selection,
							color: state.user.color,
							name: state.user.name
						});
					}
				}
			});
			this.users = list;
			this.remoteSelections = newSelections;
			this.peerCount = list.length;


			if (list.length > 1 && this._emptyRoomTimer) {
				clearTimeout(this._emptyRoomTimer);
				this._emptyRoomTimer = null;
			}


			if (this.permissionRequest && this._permissionResolver &&
				this.permissionRequest.requesterClientId === this.localClientId) {
				permissions.checkPermissionResult(this, this.permissionRequest, this.permissionVotes);
			}


			if (this.permissionRequest &&
				this.permissionRequest.requesterClientId !== this.localClientId &&
				!list.find(u => u.id === this.permissionRequest!.requesterClientId)) {
				this.permissionRequest = null;
				this.permissionVotes = new Map();
			}



			if (this.hostClientId !== null &&
				this.hostClientId !== awareness.clientID) {
				const hostGone = !list.find(u => u.id === this.hostClientId);
				if (hostGone) {

					const yMeta = this._doc?.getMap('meta');
					const latestHostId = yMeta?.get('hostClientId') as number | undefined;
					if (latestHostId && latestHostId !== this.hostClientId && list.find(u => u.id === latestHostId)) {
						this.hostClientId = latestHostId;
					}
				}
			}
		};
		this._listeners.awarenessChange = updateUsers;
		awareness.on('change', updateUsers);
		updateUsers();


		const updateCursors = () => {
			const states = awareness.getStates() as Map<number, { user?: { name: string; color: string; userId?: string }; cursor?: { x: number; y: number } | null }>;
			const newMap = new Map<number, { x: number; y: number; name: string; color: string }>();
			const seenUserIds = new Set<string>();

			states.forEach((state, clientId) => {
				if (clientId !== awareness.clientID && state.user && state.cursor) {

					const userId = (state.user.userId && state.user.userId.trim().length > 0)
						? state.user.userId.trim()
						: `anon-${clientId}`;


					if (seenUserIds.has(userId)) {
						return;
					}
					seenUserIds.add(userId);

					newMap.set(clientId, {
						x: state.cursor.x,
						y: state.cursor.y,
						name: state.user.name,
						color: state.user.color
					});
				}
			});
			this.cursorMap = newMap;
		};
		this._listeners.awarenessChangeCursors = updateCursors;
		awareness.on('change', updateCursors);


		const updateLayout = () => {
			if (diagram.animating) return;
			const states = awareness.getStates() as Map<number, any>;
			states.forEach((state, clientId) => {
				if (clientId === awareness.clientID) return;
				if (state.layoutIntent && state.layoutIntent.ts > this._lastLayoutTs) {
					this._lastLayoutTs = state.layoutIntent.ts;
					const targetPositions = new Map<string, { x: number; y: number }>();
					for (const [id, pos] of Object.entries(state.layoutIntent.positions)) {
						const p = pos as { x: number; y: number };
						targetPositions.set(id, { x: p.x, y: p.y });
					}
					if (targetPositions.size > 0) {
						diagram.applyRemoteLayout(targetPositions);
					}
				}
			});
		};
		this._listeners.awarenessChangeLayout = updateLayout;
		awareness.on('change', updateLayout);


		const updateNotation = () => {
			const states = awareness.getStates() as Map<number, any>;
			states.forEach((state, clientId) => {
				if (clientId === awareness.clientID) return;
				if (state.notationIntent && state.notationIntent.ts > this._lastNotationTs) {
					this._lastNotationTs = state.notationIntent.ts;
					const notation = state.notationIntent.notation as NotationStyle;
					if (notation && notation !== diagram.notation) {
						diagram.setNotation(notation, true);
					}
				}
			});
		};
		this._listeners.awarenessChangeNotation = updateNotation;
		awareness.on('change', updateNotation);


		const physicsLerp = () => {
			if (this._physicsLerpTargets.size === 0) {
				this._physicsLerpFrameId = 0;
				return;
			}
			const LERP_FACTOR = 0.35;
			let anyMoving = false;
			for (const [id, target] of this._physicsLerpTargets) {

				if (diagram.localDraggingIds.has(id)) continue;

				let node: { position: { x: number; y: number } } | undefined;
				if (diagram.diagramType === 'er') {
					node = diagram.entities.find(e => e.id === id);
				} else if (diagram.diagramType === 'flowchart') {
					node = diagram.flowNodes.find(n => n.id === id);
				} else if (diagram.diagramType === 'context') {
					node = diagram.dfdNodes.find(n => n.id === id);
				}
				if (!node) continue;
				const dx = target.x - node.position.x;
				const dy = target.y - node.position.y;
				if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
					node.position = { x: target.x, y: target.y };
				} else {
					node.position = {
						x: node.position.x + dx * LERP_FACTOR,
						y: node.position.y + dy * LERP_FACTOR
					};
					anyMoving = true;
				}
			}
			if (anyMoving) {
				this._physicsLerpFrameId = requestAnimationFrame(physicsLerp);
			} else {
				this._physicsLerpFrameId = 0;
			}
		};

		const updatePhysics = () => {
			const states = awareness.getStates() as Map<number, any>;
			states.forEach((state, clientId) => {
				if (clientId === awareness.clientID) return;
				if (state.physicsIntent && state.physicsIntent.ts > this._lastPhysicsTs) {
					this._lastPhysicsTs = state.physicsIntent.ts;
					if (state.physicsIntent.active && state.physicsIntent.positions) {
						const positions = state.physicsIntent.positions as Record<string, { x: number; y: number }>;
						for (const [id, pos] of Object.entries(positions)) {
							this._physicsLerpTargets.set(id, { x: pos.x, y: pos.y });
						}

						if (!this._physicsLerpFrameId) {
							this._physicsLerpFrameId = requestAnimationFrame(physicsLerp);
						}
					} else if (!state.physicsIntent.active) {

						this._physicsLerpTargets.clear();
						if (this._physicsLerpFrameId) {
							cancelAnimationFrame(this._physicsLerpFrameId);
							this._physicsLerpFrameId = 0;
						}
					}
				}
			});
		};
		this._listeners.awarenessChangePhysics = updatePhysics;
		awareness.on('change', updatePhysics);


		const dragLerp = () => {
			if (this._dragLerpTargets.size === 0) {
				this._dragLerpFrameId = 0;
				return;
			}
			const LERP_FACTOR = 0.35;
			let anyMoving = false;
			for (const [id, target] of this._dragLerpTargets) {

				if (diagram.localDraggingIds.has(id)) continue;

				let node: { position: { x: number; y: number } } | undefined;
				if (diagram.diagramType === 'er') {
					node = diagram.entities.find(e => e.id === id);
				} else if (diagram.diagramType === 'flowchart') {
					node = diagram.flowNodes.find(n => n.id === id);
				} else if (diagram.diagramType === 'context') {
					node = diagram.dfdNodes.find(n => n.id === id);
				}
				if (!node) continue;
				const dx = target.x - node.position.x;
				const dy = target.y - node.position.y;
				if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
					node.position = { x: target.x, y: target.y };
				} else {
					node.position = {
						x: node.position.x + dx * LERP_FACTOR,
						y: node.position.y + dy * LERP_FACTOR
					};
					anyMoving = true;
				}
			}
			if (anyMoving) {
				this._dragLerpFrameId = requestAnimationFrame(dragLerp);
			} else {
				this._dragLerpFrameId = 0;
			}
		};

		const updateDrag = () => {
			const states = awareness.getStates() as Map<number, any>;
			states.forEach((state, clientId) => {
				if (clientId === awareness.clientID) return;
				if (state.dragIntent) {
					const ts = state.dragIntent.ts as number;
					const lastTs = this._lastDragTs.get(clientId) ?? 0;
					if (ts <= lastTs) return;
					this._lastDragTs.set(clientId, ts);

					if (state.dragIntent.active && state.dragIntent.positions) {
						const positions = state.dragIntent.positions as Record<string, { x: number; y: number }>;
						for (const [rawId, pos] of Object.entries(positions)) {

							let nodeId = rawId;
							if (rawId.startsWith('flow:')) {
								nodeId = rawId.slice(5);
							} else if (rawId.startsWith('dfd:')) {
								nodeId = rawId.slice(4);
							}
							this._dragLerpTargets.set(nodeId, { x: pos.x, y: pos.y });
						}

						if (!this._dragLerpFrameId) {
							this._dragLerpFrameId = requestAnimationFrame(dragLerp);
						}
					} else if (!state.dragIntent.active) {

						this._dragLerpTargets.clear();
						if (this._dragLerpFrameId) {
							cancelAnimationFrame(this._dragLerpFrameId);
							this._dragLerpFrameId = 0;
						}
					}
				}
			});
		};
		this._listeners.awarenessChangeDrag = updateDrag;
		awareness.on('change', updateDrag);


		const updateDataFlow = () => {
			const states = awareness.getStates() as Map<number, any>;
			let anyRemoteActive = false;
			states.forEach((state, clientId) => {
				if (clientId === awareness.clientID) return;
				if (state.dataFlowActive) anyRemoteActive = true;
			});
			if (anyRemoteActive && !diagram.showDataFlow) {
				diagram.showDataFlow = true;
			} else if (!anyRemoteActive) {

				const localState = awareness.getLocalState() as any;
				if (!localState?.dataFlowActive && diagram.showDataFlow) {
					diagram.showDataFlow = false;
				}
			}
		};
		this._listeners.awarenessChangeDataFlow = updateDataFlow;
		awareness.on('change', updateDataFlow);


		const yEntities = this._doc.getMap('entities');
		const yRelationships = this._doc.getMap('relationships');
		const yMeta = this._doc.getMap('meta');


		const entitiesObserver = (events: Y.YEvent<any>[]) => {
			if (this.suppressLocalPush) return;


			if (diagram.selectedNodeIds.length > 0) {
				const changedIds = new Set<string>();
				for (const event of events) {
					if (event.target === yEntities) {

						for (const key of event.changes.keys.keys()) {
							changedIds.add(key);
						}
					} else if (event.path.length >= 1) {

						const entityKey = event.path[0] as string;
						if (entityKey) changedIds.add(entityKey);
					}
				}

				for (const entityId of changedIds) {
					if (diagram.selectedNodeIdSet.has(entityId)) {

						const now = Date.now();
						const lastToast = this._conflictToastTimers.get(entityId) ?? 0;
						if (now - lastToast < 3000) continue;
						this._conflictToastTimers.set(entityId, now);

						const states = awareness.getStates() as Map<number, any>;
						let editorName = '';
						states.forEach((state, clientId) => {
							if (clientId !== awareness.clientID && state.lastEdit?.entityId === entityId) {
								editorName = state.user?.name || 'Anonymous';
							}
						});
						if (editorName) {
							const entityName = diagram.entityMap.get(entityId)?.name || entityId;
							toast.info(`${editorName} แก้ไข "${entityName}" ที่คุณกำลังเลือกอยู่`);
						}
					}
				}
			}

			this.applyRemoteEntities(yEntities);
		};
		this._listeners.entitiesObserver = entitiesObserver;
		yEntities.observeDeep(entitiesObserver);


		const relationshipsObserver = () => {
			if (this.suppressLocalPush) return;
			this.applyRemoteRelationships(yRelationships);
		};
		this._listeners.relationshipsObserver = relationshipsObserver;
		yRelationships.observeDeep(relationshipsObserver);


		const metaObserver = () => {
			if (this.suppressLocalPush) return;
			const notation = yMeta.get('notation') as NotationStyle | undefined;
			if (notation && notation !== diagram.notation && !diagram.notationTransitioning && !diagram.notationAppearing) {

				diagram.setNotation(notation, true);
			}
			const font = yMeta.get('diagramFont') as string | undefined;
			if (font && font !== diagram.diagramFont) {
				diagram.diagramFont = font;
			}
			const fontSize = yMeta.get('diagramFontSize') as string | undefined;
			if (fontSize && Number(fontSize) !== diagram.diagramFontSize) {
				diagram.diagramFontSize = Number(fontSize);
			}

			const customFontsRaw = yMeta.get('customFonts') as string | undefined;
			if (customFontsRaw) {
				try {
					const remoteFonts = JSON.parse(customFontsRaw);
					if (Array.isArray(remoteFonts) && JSON.stringify(remoteFonts) !== JSON.stringify(diagram.customFonts)) {
						diagram.customFonts = remoteFonts;

						if (typeof document !== 'undefined') {
							for (const f of remoteFonts) {
								if (f.url && f.label && !document.querySelector(`link[data-custom-font="${f.label}"]`)) {
									const link = document.createElement('link');
									link.rel = 'stylesheet';
									link.href = f.url;
									link.dataset.customFont = f.label;
									document.head.appendChild(link);
								}
							}
						}
					}
				} catch { /* ignore invalid JSON */ }
			}
			const diagramType = yMeta.get('diagramType') as string | undefined;
			if (diagramType && diagramType !== diagram.diagramType) {
				diagram.diagramType = diagramType as typeof diagram.diagramType;
			}

			const diagramName = yMeta.get('diagramName') as string | undefined;
			if (diagramName && _session?.activeDiagramId) {
				_session.renameDiagram(_session.activeDiagramId, diagramName);
			}


			const hostId = yMeta.get('hostClientId') as number | undefined;
			if (hostId !== undefined) {
				this.hostClientId = hostId;
				if (!this._joinedAsHost) {
					this.isHost = awareness.clientID === hostId;
				}
			}


			const lastSaveName = yMeta.get('lastSaveUserName') as string | undefined;
			const lastSavePicture = yMeta.get('lastSaveUserPicture') as string | undefined;
			const lastSaveTime = yMeta.get('lastSaveTimestamp') as string | undefined;
			if (lastSaveName !== undefined) {
				this.lastSaveUserName = lastSaveName;
			}
			if (lastSavePicture !== undefined) {
				this.lastSaveUserPicture = lastSavePicture;
			}
			if (lastSaveTime !== undefined) {
				this.lastSaveTimestamp = parseInt(lastSaveTime, 10);
			}


			const dismissedRaw = yMeta.get('hostDismissed') as string | undefined;
			if (dismissedRaw && !this.isHost) {
				try {
					const parsed = JSON.parse(dismissedRaw);
					const currentHostId = yMeta.get('hostClientId') as number | undefined;
					if (parsed.by === currentHostId) {
						setTimeout(() => this.leaveRoom(), 0);
						return;
					}
				} catch { /* ignore */ }
			}




			const kickedRaw = yMeta.get('kicked') as string | undefined;
			if (kickedRaw) {
				try {
					const parsed = JSON.parse(kickedRaw);
					const currentHostId = yMeta.get('hostClientId') as number | undefined;
					const hostInAwareness = currentHostId !== undefined &&
						awareness.getStates().has(currentHostId);

					if (parsed && typeof parsed === 'object' && 'by' in parsed) {


						const byHost = parsed as { by: number; ids: number[] };
						if (byHost.by === currentHostId && hostInAwareness &&
							byHost.ids.includes(awareness.clientID)) {
							setTimeout(() => this.leaveRoom(), 0);
						}
					} else if (Array.isArray(parsed)) {

						if (hostInAwareness && parsed.includes(awareness.clientID)) {
							setTimeout(() => this.leaveRoom(), 0);
						}
					}
				} catch { /* invalid kicked data — ignore */ }
			}
		};
		this._listeners.metaObserver = metaObserver;
		yMeta.observe(metaObserver);


		const yPermissions = this._doc.getMap('permissions');
		const permissionsObserver = () => {
			this.syncPermissionState(yPermissions);
		};
		this._listeners.permissionsObserver = permissionsObserver;
		yPermissions.observe(permissionsObserver);


		const yChat = this._doc.getArray('chat');
		const chatObserver = () => {
			if (this._suppressChatSync) return;
			this.chatMessages = yChat.toArray() as ChatMessage[];
		};
		this._listeners.chatObserver = chatObserver;
		yChat.observe(chatObserver);


		const yNotes = this._doc.getMap('notes');
		const notesObserver = () => {
			if (this.suppressLocalPush) return;
			this.applyRemoteNotes(yNotes);
		};
		this._listeners.notesObserver = notesObserver;
		yNotes.observeDeep(notesObserver);


		const yComments = this._doc.getMap('comments');
		const commentsObserver = () => {
			if (this.suppressLocalPush) return;
			this.applyRemoteComments(yComments);
		};
		this._listeners.commentsObserver = commentsObserver;
		yComments.observeDeep(commentsObserver);


		const yFlowNodes = this._doc.getMap('flowNodes');
		const flowNodesObserver = () => {
			if (this.suppressLocalPush) return;
			this.applyRemoteFlowNodes(yFlowNodes);
		};
		this._listeners.flowNodesObserver = flowNodesObserver;
		yFlowNodes.observeDeep(flowNodesObserver);

		const yFlowEdges = this._doc.getMap('flowEdges');
		const flowEdgesObserver = () => {
			if (this.suppressLocalPush) return;
			this.applyRemoteFlowEdges(yFlowEdges);
		};
		this._listeners.flowEdgesObserver = flowEdgesObserver;
		yFlowEdges.observeDeep(flowEdgesObserver);


		const yDFDNodes = this._doc.getMap('dfdNodes');
		const dfdNodesObserver = () => {
			if (this.suppressLocalPush) return;
			this.applyRemoteDFDNodes(yDFDNodes);
		};
		this._listeners.dfdNodesObserver = dfdNodesObserver;
		yDFDNodes.observeDeep(dfdNodesObserver);

		const yDFDFlows = this._doc.getMap('dfdFlows');
		const dfdFlowsObserver = () => {
			if (this.suppressLocalPush) return;
			this.applyRemoteDFDFlows(yDFDFlows);
		};
		this._listeners.dfdFlowsObserver = dfdFlowsObserver;
		yDFDFlows.observeDeep(dfdFlowsObserver);



		this._undoManager = new UndoManager(
			[yEntities, yRelationships, yNotes, yComments, yFlowNodes, yFlowEdges, yDFDNodes, yDFDFlows],
			{ captureTimeout: 500 }
		);


		const syncedHandler = ({ synced }: { synced: boolean }) => {
			if (synced) {
				this.synced = true;
				if (yEntities.size === 0 && diagram.entities.length > 0) {
					this.pushFullState();
				}

				const hostId = yMeta.get('hostClientId') as number | undefined;
				if (hostId !== undefined) {
					this.hostClientId = hostId;
					if (!this._joinedAsHost) {
						this.isHost = awareness.clientID === hostId;
					}
				}
			}
		};
		this._listeners.providerSynced = syncedHandler;
		provider.on('synced', syncedHandler);


		if (asHost) {

			this.suppressLocalPush = true;
			try {
				yMeta.set('hostClientId', awareness.clientID);
				yMeta.delete('kicked');
				yMeta.delete('hostDismissed');
			} finally {
				this.suppressLocalPush = false;
			}
			this.pushFullState();
		}


		const peersHandler = ({ webrtcPeers }: { webrtcPeers: string[] }) => {
			if (webrtcPeers.length > 0 && !this.synced) {
				this.synced = true;
			}
		};
		this._listeners.providerPeers = peersHandler;
		provider.on('peers', peersHandler);


		this.saveRoomInfo();


		if (!asHost) {
			this._emptyRoomTimer = setTimeout(() => {
				this._emptyRoomTimer = null;
				if (this.connected && this.peerCount <= 1) {
					toast.warning('ห้องนี้ปิดแล้วหรือไม่มีผู้ใช้อยู่');
					this.leaveRoom();
				}
			}, 4000);
		}
	}


	private setupStorageListener() {

		if (this.storageListener && typeof window !== 'undefined') {
			window.removeEventListener('storage', this.storageListener);
		}


		if (typeof window !== 'undefined') {
			this.storageListener = (e: StorageEvent) => {

				if (e.key === 'collab-leave-signal' && e.newValue) {
					try {
						const signal = JSON.parse(e.newValue);
						const myUserId = auth.user?.sub || '';


						if (signal.userId && signal.userId === myUserId && myUserId !== '') {

							setTimeout(() => {
								if (this.connected) {
									this.leaveRoom();
								}
							}, 100);
						}
					} catch {
						// Ignore invalid JSON
					}
				}
			};
			window.addEventListener('storage', this.storageListener);
		}
	}


	leaveRoom(silent = false) {
		if (this.lockTimer) clearInterval(this.lockTimer);
		this.lockTimer = null;
		if (this.connected && this.lockOwner) {
			const ids = [...this.editLocks].filter(([, lock]) => lock.owner === this.lockOwner).map(([id]) => id);
			void fetch('/api/collab/locks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
				body: JSON.stringify({ room: this.roomId, token: this.roomToken, owner: this.lockOwner, name: this.userName || 'Anonymous', ids, release: true }) }).catch(() => {});
		}
		this.lockOwner = '';
		this.editLocks = new Map();
		this.desiredLocks = [];
		this.transientLocks.clear();
		const wasJoiner = this.connected && !this.isHost;
		const wasHost = this.connected && this.isHost;
		const wasConnectedWithOthers = this.users.length > 1;


		if (!silent && typeof localStorage !== 'undefined' && auth.user?.sub) {
			const leaveSignal = {
				userId: auth.user.sub,
				timestamp: Date.now()
			};
			try {
				localStorage.setItem('collab-leave-signal', JSON.stringify(leaveSignal));

				setTimeout(() => {
					localStorage.removeItem('collab-leave-signal');
				}, 500);
			} catch {
				// Ignore localStorage errors
			}
		}


		const hostBackup = wasHost ? {
			entities: snap(diagram.entities),
			relationships: snap(diagram.relationships),
			notes: snap(diagram.notes),
			comments: snap(diagram.comments),
			notation: diagram.notation,
			diagramFont: diagram.diagramFont,
			diagramFontSize: diagram.diagramFontSize,
			diagramType: diagram.diagramType,
			flowNodes: snap(diagram.flowNodes),
			flowEdges: snap(diagram.flowEdges),
			dfdNodes: snap(diagram.dfdNodes),
			dfdFlows: snap(diagram.dfdFlows),
			customFonts: snap(diagram.customFonts),
		} : null;


		if (this._emptyRoomTimer) {
			clearTimeout(this._emptyRoomTimer);
			this._emptyRoomTimer = null;
		}


		this.suppressLocalPush = true;


		if (this._permissionResolver) {
			this._permissionResolver(false);
			this._permissionResolver = null;
		}
		if (this._permissionTimeout) {
			clearTimeout(this._permissionTimeout);
			this._permissionTimeout = null;
		}
		this.permissionRequest = null;
		this.permissionVotes = new Map();
		this.permissionGrants = new Map();
		this.chatMessages = [];
		if (this._cursorTimer) { clearTimeout(this._cursorTimer); this._cursorTimer = null; }
		this.cursorMap = new Map();
		this.remoteSelections = new Map();
		this.localClientId = -1;

		this._dragLerpTargets.clear();
		this._lastDragTs.clear();
		if (this._dragLerpFrameId) {
			cancelAnimationFrame(this._dragLerpFrameId);
			this._dragLerpFrameId = 0;
		}
		this.lastSaveUserName = null;
		this.lastSaveUserPicture = null;
		this.lastSaveTimestamp = null;


		voiceChat.disconnect();


		if (this._provider && this._doc) {
			const awareness = this._provider.awareness;


			if (this._listeners.awarenessChange) {
				awareness.off('change', this._listeners.awarenessChange);
			}
			if (this._listeners.awarenessChangeCursors) {
				awareness.off('change', this._listeners.awarenessChangeCursors);
			}
			if (this._listeners.awarenessChangeLayout) {
				awareness.off('change', this._listeners.awarenessChangeLayout);
			}
			if (this._listeners.awarenessChangeNotation) {
				awareness.off('change', this._listeners.awarenessChangeNotation);
			}
			if (this._listeners.awarenessChangePhysics) {
				awareness.off('change', this._listeners.awarenessChangePhysics);
			}
			if (this._listeners.awarenessChangeDrag) {
				awareness.off('change', this._listeners.awarenessChangeDrag);
			}
			if (this._listeners.awarenessChangeDataFlow) {
				awareness.off('change', this._listeners.awarenessChangeDataFlow);
			}


			const yEntities = this._doc.getMap('entities');
			const yRelationships = this._doc.getMap('relationships');
			const yMeta = this._doc.getMap('meta');
			const yPermissions = this._doc.getMap('permissions');
			const yChat = this._doc.getArray('chat');
			const yNotes = this._doc.getMap('notes');
			const yComments = this._doc.getMap('comments');
			const yFlowNodes = this._doc.getMap('flowNodes');
			const yFlowEdges = this._doc.getMap('flowEdges');
			const yDFDNodes = this._doc.getMap('dfdNodes');
			const yDFDFlows = this._doc.getMap('dfdFlows');

			if (this._listeners.entitiesObserver) yEntities.unobserveDeep(this._listeners.entitiesObserver as any);
			if (this._listeners.relationshipsObserver) yRelationships.unobserveDeep(this._listeners.relationshipsObserver as any);
			if (this._listeners.metaObserver) yMeta.unobserve(this._listeners.metaObserver as any);
			if (this._listeners.permissionsObserver) yPermissions.unobserve(this._listeners.permissionsObserver as any);
			if (this._listeners.chatObserver) yChat.unobserve(this._listeners.chatObserver as any);
			if (this._listeners.notesObserver) yNotes.unobserveDeep(this._listeners.notesObserver as any);
			if (this._listeners.commentsObserver) yComments.unobserveDeep(this._listeners.commentsObserver as any);
			if (this._listeners.flowNodesObserver) yFlowNodes.unobserveDeep(this._listeners.flowNodesObserver as any);
			if (this._listeners.flowEdgesObserver) yFlowEdges.unobserveDeep(this._listeners.flowEdgesObserver as any);
			if (this._listeners.dfdNodesObserver) yDFDNodes.unobserveDeep(this._listeners.dfdNodesObserver as any);
			if (this._listeners.dfdFlowsObserver) yDFDFlows.unobserveDeep(this._listeners.dfdFlowsObserver as any);


			if (this._listeners.providerSynced) this._provider.off('synced', this._listeners.providerSynced as any);
			if (this._listeners.providerPeers) this._provider.off('peers', this._listeners.providerPeers as any);
		}
		this._listeners = {};

		if (this._undoManager) {
			this._undoManager.destroy();
			this._undoManager = null;
		}
		if (this._provider) {
			this._provider.destroy();
			this._provider = null;
		}
		if (this._doc) {
			this._doc.destroy();
			this._doc = null;
		}
		this.connected = false;
		this.synced = false;
		this.peerCount = 0;
		this.roomId = '';
		this.roomToken = '';
		this.users = [];
		this.isHost = false;
		this._joinedAsHost = false;
		this.hostClientId = null;
		if (this.syncFallbackTimer) {
			clearTimeout(this.syncFallbackTimer);
			this.syncFallbackTimer = null;
		}
		this.clearRoomInfo();


		if (!silent && typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			if (url.searchParams.has('room') || url.searchParams.has('token')) {
				url.searchParams.delete('room');
				url.searchParams.delete('token');
				window.history.replaceState({}, '', url.pathname + (url.search || ''));
			}
		}


		if (this.storageListener && typeof window !== 'undefined') {
			window.removeEventListener('storage', this.storageListener);
			this.storageListener = null;
		}



		if (wasJoiner && !silent && wasConnectedWithOthers) {
			diagram.entities = [];
			diagram.relationships = [];
			diagram.flowNodes = [];
			diagram.flowEdges = [];
			diagram.dfdNodes = [];
			diagram.dfdFlows = [];
		}


		if (hostBackup && hostBackup.entities.length > 0 && diagram.entities.length === 0) {
			diagram.entities = hostBackup.entities;
			diagram.relationships = hostBackup.relationships;
			diagram.notes = hostBackup.notes;
			diagram.comments = hostBackup.comments;
			diagram.notation = hostBackup.notation as NotationStyle;
			diagram.diagramFont = hostBackup.diagramFont;
			diagram.diagramFontSize = hostBackup.diagramFontSize ?? 14;
			diagram.diagramType = hostBackup.diagramType as typeof diagram.diagramType;
			diagram.flowNodes = hostBackup.flowNodes;
			diagram.flowEdges = hostBackup.flowEdges;
			diagram.dfdNodes = hostBackup.dfdNodes;
			diagram.dfdFlows = hostBackup.dfdFlows;
			diagram.customFonts = hostBackup.customFonts;
		}


		this.suppressLocalPush = false;
	}


	dismissRoom() {
		if (!this._doc || !this._provider || !this.isHost) {
			this.leaveRoom();
			return;
		}
		const yMeta = this._doc.getMap('meta');
		yMeta.set('hostDismissed', JSON.stringify({
			by: this._provider.awareness.clientID
		}));

		setTimeout(() => this.leaveRoom(), 150);
	}


	kickUser(clientId: number) {
		if (!this._doc || !this.isHost || !this._provider) return;
		const yMeta = this._doc.getMap('meta');
		const myId = this._provider.awareness.clientID;

		let kickedIds: number[] = [];
		try {
			const raw = yMeta.get('kicked') as string | undefined;
			if (raw) {
				const data = JSON.parse(raw);
				if (data && 'by' in data && data.by === myId) {
					kickedIds = data.ids || [];
				}
				// If old format or different host, start fresh
			}
		} catch { /* ignore */ }
		if (!kickedIds.includes(clientId)) {
			kickedIds.push(clientId);
		}
		this.suppressLocalPush = true;
		try {
			yMeta.set('kicked', JSON.stringify({ by: myId, ids: kickedIds }));
		} finally {
			this.suppressLocalPush = false;
		}
	}


	pushDiagramName(name: string) {
		this.pushMeta('diagramName', name);
	}



	requestPermission(action: PermissionAction): Promise<boolean> {
		return permissions.requestPermission(this, action);
	}

	submitVote(vote: 'approve' | 'deny') {
		permissions.submitVote(this, vote);
	}

	cancelPermissionRequest() {
		permissions.cancelPermissionRequest(this);
	}

	grantPermission(clientId: number, action: PermissionAction) {
		permissions.grantPermission(this, clientId, action);
	}

	revokePermission(clientId: number, action: PermissionAction) {
		permissions.revokePermission(this, clientId, action);
	}

	hasGrant(clientId: number, action: PermissionAction): boolean {
		return permissions.hasGrant(this, clientId, action);
	}

	private syncPermissionState(yPerms: Y.Map<unknown>) {
		permissions.syncPermissionState(this, yPerms);
	}

	private _cursorTimer: ReturnType<typeof setTimeout> | null = null;


	updateSelection(ids: string[]) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('selection', ids);
		this.desiredLocks = this.isViewer ? [] : [...ids];
		void this.acquireLocks(this.desiredLocks, false).then(() => this.releaseUnusedLocks());
	}


	updateCursor(x: number, y: number) {
		if (!this.connected || !this._provider) return;
		if (this._cursorTimer) return;
		this._cursorTimer = setTimeout(() => {
			this._cursorTimer = null;
		}, 150);
		this._provider.awareness.setLocalStateField('cursor', { x, y });
	}


	clearCursor() {
		if (!this.connected || !this._provider) return;
		if (this._cursorTimer) {
			clearTimeout(this._cursorTimer);
			this._cursorTimer = null;
		}
		this._provider.awareness.setLocalStateField('cursor', null);
	}


	broadcastLayout(positions: Record<string, { x: number; y: number }>) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('layoutIntent', { positions, ts: Date.now() });

		setTimeout(() => {
			this._provider?.awareness.setLocalStateField('layoutIntent', null);
		}, 1500);
	}


	broadcastNotation(notation: string) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('notationIntent', { notation, ts: Date.now() });
		setTimeout(() => {
			this._provider?.awareness.setLocalStateField('notationIntent', null);
		}, 2500);
	}


	broadcastPhysicsPositions(positions: Record<string, { x: number; y: number }>) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('physicsIntent', { positions, active: true, ts: Date.now() });
	}


	broadcastPhysicsStop() {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('physicsIntent', { active: false, ts: Date.now() });
		setTimeout(() => {
			this._provider?.awareness.setLocalStateField('physicsIntent', null);
		}, 500);
	}


	broadcastDragPositions(positions: Record<string, { x: number; y: number }>) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('dragIntent', { positions, active: true, ts: Date.now() });
	}


	broadcastDragStop() {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('dragIntent', { active: false, ts: Date.now() });
		setTimeout(() => {
			this._provider?.awareness.setLocalStateField('dragIntent', null);
		}, 500);
	}


	broadcastDataFlow(active: boolean) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('dataFlowActive', active);
	}


	pushSaveEvent() {
		if (!this._doc || this.suppressLocalPush) return;
		const yMeta = this._doc.getMap('meta');
		this.suppressLocalPush = true;
		try {
			yMeta.set('lastSaveUserName', this.userName || 'Anonymous');
			yMeta.set('lastSaveUserPicture', this.userPicture || '');
			yMeta.set('lastSaveTimestamp', Date.now().toString());
		} finally {
			this.suppressLocalPush = false;
		}
	}


	get isViewer(): boolean {
		return false;
	}



	pushChatMessage(msg: ChatMessage) {
		chat.pushChatMessage(this, msg);
	}

	clearChat() {
		chat.clearChat(this);
	}


	markChatActionApplied(msgIndex: number, appliedBy: string) {
		if (!this._doc) return;
		const yChat = this._doc.getArray('chat');
		if (msgIndex < 0 || msgIndex >= yChat.length) return;
		const existing = yChat.get(msgIndex) as ChatMessage;
		if (!existing?.action) return;
		const updated: ChatMessage = {
			...snap(existing),
			action: { ...snap(existing.action!), appliedBy }
		};
		this._suppressChatSync = true;
		try {
			this._doc.transact(() => {
				yChat.delete(msgIndex, 1);
				yChat.insert(msgIndex, [updated]);
			});
		} finally {
			this._suppressChatSync = false;
		}
		this.chatMessages = yChat.toArray() as ChatMessage[];
	}

	restoreChat() {
		chat.restoreChat(this);
	}



	collabUndo(): boolean {
		if (!this._undoManager) return false;
		this._undoManager.undo();
		return true;
	}

	collabRedo(): boolean {
		if (!this._undoManager) return false;
		this._undoManager.redo();
		return true;
	}



	pushNoteChange(note: Note) {
		if (!this._doc || this.suppressLocalPush) return;
		const n = snap(note);
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				const yNotes = this._doc!.getMap('notes');
				const yNote = new Y.Map();
				yNote.set('id', n.id);
				yNote.set('text', n.text);
				yNote.set('positionX', n.position.x);
				yNote.set('positionY', n.position.y);
				yNote.set('color', n.color || 'yellow');
				yNotes.set(n.id, yNote);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushNoteRemove(id: string) {
		if (!this._doc || this.suppressLocalPush) return;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				this._doc!.getMap('notes').delete(id);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	private applyRemoteNotes(yNotes: Y.Map<unknown>) {
		const notes: Note[] = [];
		yNotes.forEach((value) => {
			const yNote = value as Y.Map<unknown>;
			notes.push({
				id: yNote.get('id') as string,
				text: yNote.get('text') as string,
				position: {
					x: yNote.get('positionX') as number,
					y: yNote.get('positionY') as number
				},
				color: (yNote.get('color') as Note['color']) || 'yellow'
			});
		});
		diagram.notes = notes;
	}



	pushCommentChange(comment: Comment) {
		if (!this._doc || this.suppressLocalPush) return;
		const c = snap(comment);
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				const yComments = this._doc!.getMap('comments');
				const yComment = new Y.Map();
				yComment.set('id', c.id);
				yComment.set('targetId', c.targetId);
				yComment.set('targetType', c.targetType);
				yComment.set('text', c.text);
				yComment.set('authorName', c.authorName);
				yComment.set('createdAt', c.createdAt);
				yComment.set('resolved', c.resolved ?? false);
				yComment.set('parentId', c.parentId ?? null);
				yComments.set(c.id, yComment);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushCommentRemove(id: string) {
		if (!this._doc || this.suppressLocalPush) return;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				this._doc!.getMap('comments').delete(id);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	private applyRemoteComments(yComments: Y.Map<unknown>) {
		const comments: Comment[] = [];
		yComments.forEach((value) => {
			const yComment = value as Y.Map<unknown>;
			comments.push({
				id: yComment.get('id') as string,
				targetId: yComment.get('targetId') as string,
				targetType: yComment.get('targetType') as Comment['targetType'],
				text: yComment.get('text') as string,
				authorName: yComment.get('authorName') as string,
				createdAt: yComment.get('createdAt') as number,
				resolved: (yComment.get('resolved') as boolean) ?? false,
				parentId: (yComment.get('parentId') as string | null) ?? null
			});
		});
		diagram.comments = comments;
	}



	pushFlowNodeChange(node: FlowNode) {
		if (!this._doc || this.suppressLocalPush) return;
		const n = snap(node);
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				const yNodes = this._doc!.getMap('flowNodes');
				const yNode = new Y.Map();
				yNode.set('id', n.id);
				yNode.set('name', n.name);
				yNode.set('type', n.type);
				yNode.set('positionX', n.position.x);
				yNode.set('positionY', n.position.y);
				if (n.color) yNode.set('color', n.color);
				if (n.borderRadius !== undefined) yNode.set('borderRadius', n.borderRadius);
				if (n.width !== undefined) yNode.set('width', n.width);
				if (n.height !== undefined) yNode.set('height', n.height);
				if (n.fontSize !== undefined) yNode.set('fontSize', n.fontSize);
				if (n.bold !== undefined) yNode.set('bold', n.bold);
				if (n.italic !== undefined) yNode.set('italic', n.italic);
				yNodes.set(n.id, yNode);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushFlowNodeRemove(id: string) {
		if (!this._doc || this.suppressLocalPush) return;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => { this._doc!.getMap('flowNodes').delete(id); });
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushFlowEdgeChange(edge: FlowEdge) {
		if (!this._doc || this.suppressLocalPush) return;
		const e = snap(edge);
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				const yEdges = this._doc!.getMap('flowEdges');
				const yEdge = new Y.Map();
				yEdge.set('id', e.id);
				yEdge.set('label', e.label);
				yEdge.set('fromNodeId', e.fromNodeId);
				yEdge.set('toNodeId', e.toNodeId);
				if (e.condition) yEdge.set('condition', e.condition);
				if (e.fromSide) yEdge.set('fromSide', e.fromSide);
				if (e.toSide) yEdge.set('toSide', e.toSide);
				for (const key of ['labelOffset', 'waypoints', 'lineStyle', 'strokeWidth', 'strokeDash', 'edgeColor', 'arrowHead', 'arrowDirection', 'startArrow', 'endArrow', 'routingMode'] as const) { if (e[key] !== undefined) yEdge.set(key, e[key]); }
				yEdges.set(e.id, yEdge);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushFlowEdgeRemove(id: string) {
		if (!this._doc || this.suppressLocalPush) return;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => { this._doc!.getMap('flowEdges').delete(id); });
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	private applyRemoteFlowNodes(yNodes: Y.Map<unknown>) {
		const nodes: FlowNode[] = [];
		yNodes.forEach((value) => {
			const y = value as Y.Map<unknown>;
			nodes.push({
				id: y.get('id') as string,
				name: y.get('name') as string,
				type: y.get('type') as FlowNode['type'],
				position: { x: y.get('positionX') as number, y: y.get('positionY') as number },
				color: y.get('color') as string | undefined,
				borderRadius: y.get('borderRadius') as number | undefined,
				width: y.get('width') as number | undefined,
				height: y.get('height') as number | undefined,
				fontSize: y.get('fontSize') as number | undefined,
				bold: y.get('bold') as boolean | undefined,
				italic: y.get('italic') as boolean | undefined
			});
		});


		const oldIds = new Set(diagram.flowNodes.map(n => n.id));
		const newIds = nodes.filter(n => !oldIds.has(n.id)).map(n => n.id);
		if (newIds.length > 0) {
			diagram.newEntityIds = new Set([...diagram.newEntityIds, ...newIds]);
			setTimeout(() => {
				diagram.newEntityIds = new Set(
					[...diagram.newEntityIds].filter(id => !newIds.includes(id))
				);
			}, 600);
		}


		const remoteIds = new Set(nodes.map(n => n.id));
		const removedNodes = diagram.flowNodes.filter(n => !remoteIds.has(n.id));
		if (removedNodes.length > 0) {
			const dyingEnts = removedNodes.map(n => ({
				...n, attributes: [], isWeak: false,
				_dyingRect: { x: n.position.x, y: n.position.y, width: 160, height: 80 }
			}));
			diagram.dyingEntities = [...diagram.dyingEntities, ...dyingEnts] as any;
			const dyingIds = new Set(removedNodes.map(n => n.id));
			setTimeout(() => {
				diagram.dyingEntities = diagram.dyingEntities.filter(e => !dyingIds.has(e.id));
			}, 900);
		}

		diagram.flowNodes = nodes;
	}

	private applyRemoteFlowEdges(yEdges: Y.Map<unknown>) {
		const edges: FlowEdge[] = [];
		yEdges.forEach((value) => {
			const y = value as Y.Map<unknown>;
			const edge: FlowEdge = {
				id: y.get('id') as string,
				label: y.get('label') as string,
				fromNodeId: y.get('fromNodeId') as string,
				toNodeId: y.get('toNodeId') as string
			};
			const condition = y.get('condition') as string | undefined;
			if (condition === 'yes' || condition === 'no') edge.condition = condition;
			const fromSide = y.get('fromSide') as FlowEdge['fromSide'] | undefined;
			if (fromSide) edge.fromSide = fromSide;
			const toSide = y.get('toSide') as FlowEdge['toSide'] | undefined;
			if (toSide) edge.toSide = toSide;
			for (const key of ['labelOffset', 'waypoints', 'lineStyle', 'strokeWidth', 'strokeDash', 'edgeColor', 'arrowHead', 'arrowDirection', 'startArrow', 'endArrow', 'routingMode'] as const) { const value = y.get(key); if (value !== undefined) Object.assign(edge, { [key]: value }); }
			edges.push(edge);
		});


		const oldIds = new Set(diagram.flowEdges.map(e => e.id));
		const newIds = edges.filter(e => !oldIds.has(e.id)).map(e => e.id);
		if (newIds.length > 0) {
			diagram.newRelationshipIds = new Set([...diagram.newRelationshipIds, ...newIds]);
			setTimeout(() => {
				diagram.newRelationshipIds = new Set(
					[...diagram.newRelationshipIds].filter(id => !newIds.includes(id))
				);
			}, 3500);
		}

		diagram.flowEdges = edges;
	}



	pushDFDNodeChange(node: DFDNode) {
		if (!this._doc || this.suppressLocalPush) return;
		const n = snap(node);
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				const yNodes = this._doc!.getMap('dfdNodes');
				const yNode = new Y.Map();
				yNode.set('id', n.id);
				yNode.set('name', n.name);
				yNode.set('type', n.type);
				yNode.set('positionX', n.position.x);
				yNode.set('positionY', n.position.y);
				if (n.processNumber) yNode.set('processNumber', n.processNumber);
				for (const key of ['width', 'height', 'storeNumber', 'boundarySourceId'] as const) if (n[key] !== undefined) yNode.set(key, n[key]);
				if (n.color) yNode.set('color', n.color);
				if (n.parentId) yNode.set('parentId', n.parentId);
				yNodes.set(n.id, yNode);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushDFDNodeRemove(id: string) {
		if (!this._doc || this.suppressLocalPush) return;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => { this._doc!.getMap('dfdNodes').delete(id); });
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushDFDFlowChange(flow: DFDFlow) {
		if (!this._doc || this.suppressLocalPush) return;
		const f = snap(flow);
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				const yFlows = this._doc!.getMap('dfdFlows');
				const yFlow = new Y.Map();
				yFlow.set('id', f.id);
				yFlow.set('label', f.label);
				if (f.boundaryFlowId) yFlow.set('boundaryFlowId', f.boundaryFlowId);
				yFlow.set('fromNodeId', f.fromNodeId);
				yFlow.set('toNodeId', f.toNodeId);
				if (f.parentId) yFlow.set('parentId', f.parentId);
				yFlows.set(f.id, yFlow);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushDFDFlowRemove(id: string) {
		if (!this._doc || this.suppressLocalPush) return;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => { this._doc!.getMap('dfdFlows').delete(id); });
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	private applyRemoteDFDNodes(yNodes: Y.Map<unknown>) {
		const nodes: DFDNode[] = [];
		yNodes.forEach((value) => {
			const y = value as Y.Map<unknown>;
			nodes.push({
				id: y.get('id') as string,
				name: y.get('name') as string,
				type: y.get('type') as DFDNode['type'],
				position: { x: y.get('positionX') as number, y: y.get('positionY') as number },
				processNumber: y.get('processNumber') as string | undefined,
				width: y.get('width') as number | undefined,
				height: y.get('height') as number | undefined,
				storeNumber: y.get('storeNumber') as string | undefined,
				boundarySourceId: y.get('boundarySourceId') as string | undefined,
				color: y.get('color') as string | undefined,
				parentId: y.get('parentId') as string | undefined
			});
		});


		const oldIds = new Set(diagram.dfdNodes.map(n => n.id));
		const newIds = nodes.filter(n => !oldIds.has(n.id)).map(n => n.id);
		if (newIds.length > 0) {
			diagram.newEntityIds = new Set([...diagram.newEntityIds, ...newIds]);
			setTimeout(() => {
				diagram.newEntityIds = new Set(
					[...diagram.newEntityIds].filter(id => !newIds.includes(id))
				);
			}, 600);
		}


		const remoteIds = new Set(nodes.map(n => n.id));
		const removedNodes = diagram.dfdNodes.filter(n => !remoteIds.has(n.id));
		if (removedNodes.length > 0) {
			const dyingEnts = removedNodes.map(n => ({
				...n, attributes: [], isWeak: false,
				_dyingRect: { x: n.position.x, y: n.position.y, width: 160, height: 80 }
			}));
			diagram.dyingEntities = [...diagram.dyingEntities, ...dyingEnts] as any;
			const dyingIds = new Set(removedNodes.map(n => n.id));
			setTimeout(() => {
				diagram.dyingEntities = diagram.dyingEntities.filter(e => !dyingIds.has(e.id));
			}, 900);
		}

		diagram.dfdNodes = nodes;
	}

	private applyRemoteDFDFlows(yFlows: Y.Map<unknown>) {
		const flows: DFDFlow[] = [];
		yFlows.forEach((value) => {
			const y = value as Y.Map<unknown>;
			flows.push({
				id: y.get('id') as string,
				label: y.get('label') as string,
				fromNodeId: y.get('fromNodeId') as string,
				toNodeId: y.get('toNodeId') as string,
				parentId: y.get('parentId') as string | undefined,
				boundaryFlowId: y.get('boundaryFlowId') as string | undefined
			});
		});


		const oldIds = new Set(diagram.dfdFlows.map(f => f.id));
		const newIds = flows.filter(f => !oldIds.has(f.id)).map(f => f.id);
		if (newIds.length > 0) {
			diagram.newRelationshipIds = new Set([...diagram.newRelationshipIds, ...newIds]);
			setTimeout(() => {
				diagram.newRelationshipIds = new Set(
					[...diagram.newRelationshipIds].filter(id => !newIds.includes(id))
				);
			}, 3500);
		}

		diagram.dfdFlows = flows;
	}








	private scheduleSyncFallback() {
		if (!this.connected || !this._doc) return;
		if (this.syncFallbackTimer) clearTimeout(this.syncFallbackTimer);
		this.syncFallbackTimer = setTimeout(() => {
			this.syncFallbackTimer = null;
			if (this.connected && this._doc) {
				this.pushFullState();
			}
		}, 1500);
	}

	pushEntityChange(entity: Entity) {
		if (!this._doc || this.suppressLocalPush) return;
		const e = snap(entity);
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				const yEntities = this._doc!.getMap('entities');
				const yEntity = new Y.Map();
				yEntity.set('id', e.id);
				yEntity.set('name', e.name);
				yEntity.set('isWeak', e.isWeak);
				yEntity.set('positionX', e.position.x);
				yEntity.set('positionY', e.position.y);
				yEntity.set('attributes', JSON.stringify(e.attributes));
				if (e.sampleRows) yEntity.set('sampleRows', JSON.stringify(e.sampleRows));
				if (e.isLocked) yEntity.set('isLocked', true);
				if (e.color) yEntity.set('color', e.color);
				if (e.fontSize !== undefined) yEntity.set('fontSize', e.fontSize);
				if (e.bold !== undefined) yEntity.set('bold', e.bold);
				if (e.italic !== undefined) yEntity.set('italic', e.italic);
				yEntities.set(e.id, yEntity);
			});
		} finally {
			this.suppressLocalPush = false;
		}

		if (this._provider) {
			this._provider.awareness.setLocalStateField('lastEdit', { entityId: e.id, timestamp: Date.now() });
		}
		this.scheduleSyncFallback();
	}

	pushEntityRemove(id: string) {
		if (!this._doc || this.suppressLocalPush) return;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				this._doc!.getMap('entities').delete(id);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushRelationshipChange(rel: Relationship) {
		if (!this._doc || this.suppressLocalPush) return;
		const r = snap(rel);
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				const yRelationships = this._doc!.getMap('relationships');
				const yRel = new Y.Map();
				yRel.set('id', r.id);
				yRel.set('name', r.name);
				yRel.set('entityIds', JSON.stringify(r.entityIds));
				yRel.set('cardinalities', JSON.stringify(r.cardinalities));
				yRel.set('isIdentifying', r.isIdentifying);
				if (r.labelOffset) yRel.set('labelOffset', r.labelOffset); else yRel.delete('labelOffset');
				for (const field of ['waypoints', 'fromWaypoints', 'toWaypoints', 'diamondPosition', 'fromAnchor', 'toAnchor', 'fromCardinalityOffset', 'toCardinalityOffset'] as const) if (r[field]) yRel.set(field, r[field]); else yRel.delete(field);
				yRel.set('dataFlowDirection', r.dataFlowDirection ?? 'none');
				yRelationships.set(r.id, yRel);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushRelationshipRemove(id: string) {
		if (!this._doc || this.suppressLocalPush) return;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				this._doc!.getMap('relationships').delete(id);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushMeta(key: string, value: string) {
		if (!this._doc || this.suppressLocalPush) return;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				this._doc!.getMap('meta').set(key, value);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		this.scheduleSyncFallback();
	}

	pushFullState() {
		if (!this._doc) return;


		const entities = snap(diagram.entities);
		const dyingRelIds = diagram.dyingRelationshipIds;
		const relationships = snap(
			dyingRelIds.size > 0
				? diagram.relationships.filter(r => !dyingRelIds.has(r.id))
				: diagram.relationships
		);
		const notes = snap(diagram.notes);
		const comments = snap(diagram.comments);
		const flowNodes = snap(diagram.flowNodes);
		const flowEdges = snap(diagram.flowEdges);
		const dfdNodes = snap(diagram.dfdNodes);
		const dfdFlows = snap(diagram.dfdFlows);
		const notation = diagram.notation;
		const font = diagram.diagramFont;
		this.suppressLocalPush = true;
		try {
			this._doc.transact(() => {
				const yEntities = this._doc!.getMap('entities');
				const yRelationships = this._doc!.getMap('relationships');
				const yNotes = this._doc!.getMap('notes');
				const yComments = this._doc!.getMap('comments');
				const yFlowNodes = this._doc!.getMap('flowNodes');
				const yFlowEdges = this._doc!.getMap('flowEdges');
				const yDFDNodes = this._doc!.getMap('dfdNodes');
				const yDFDFlows = this._doc!.getMap('dfdFlows');
				const yMeta = this._doc!.getMap('meta');


				yEntities.forEach((_: unknown, key: string) => {
					if (!entities.find((e: Entity) => e.id === key)) yEntities.delete(key);
				});
				yRelationships.forEach((_: unknown, key: string) => {
					if (!relationships.find((r: Relationship) => r.id === key)) yRelationships.delete(key);
				});
				yNotes.forEach((_: unknown, key: string) => {
					if (!notes.find((n: Note) => n.id === key)) yNotes.delete(key);
				});
				yComments.forEach((_: unknown, key: string) => {
					if (!comments.find((c: Comment) => c.id === key)) yComments.delete(key);
				});
				yFlowNodes.forEach((_: unknown, key: string) => {
					if (!flowNodes.find((n: FlowNode) => n.id === key)) yFlowNodes.delete(key);
				});
				yFlowEdges.forEach((_: unknown, key: string) => {
					if (!flowEdges.find((e: FlowEdge) => e.id === key)) yFlowEdges.delete(key);
				});
				yDFDNodes.forEach((_: unknown, key: string) => {
					if (!dfdNodes.find((n: DFDNode) => n.id === key)) yDFDNodes.delete(key);
				});
				yDFDFlows.forEach((_: unknown, key: string) => {
					if (!dfdFlows.find((f: DFDFlow) => f.id === key)) yDFDFlows.delete(key);
				});

				for (const entity of entities) {
					const yEntity = new Y.Map();
					yEntity.set('id', entity.id);
					yEntity.set('name', entity.name);
					yEntity.set('isWeak', entity.isWeak);
					yEntity.set('positionX', entity.position.x);
					yEntity.set('positionY', entity.position.y);
					yEntity.set('attributes', JSON.stringify(entity.attributes));
					if (entity.sampleRows) yEntity.set('sampleRows', JSON.stringify(entity.sampleRows));
					if (entity.isLocked) yEntity.set('isLocked', true);
					yEntities.set(entity.id, yEntity);
				}

				for (const rel of relationships) {
					const yRel = new Y.Map();
					yRel.set('id', rel.id);
					yRel.set('name', rel.name);
					yRel.set('entityIds', JSON.stringify(rel.entityIds));
					yRel.set('cardinalities', JSON.stringify(rel.cardinalities));
					yRel.set('isIdentifying', rel.isIdentifying);
				if (rel.labelOffset) yRel.set('labelOffset', rel.labelOffset); else yRel.delete('labelOffset');
				for (const field of ['waypoints', 'fromWaypoints', 'toWaypoints', 'diamondPosition', 'fromAnchor', 'toAnchor', 'fromCardinalityOffset', 'toCardinalityOffset'] as const) if (rel[field]) yRel.set(field, rel[field]); else yRel.delete(field);
				yRel.set('dataFlowDirection', rel.dataFlowDirection ?? 'none');
					yRelationships.set(rel.id, yRel);
				}

				for (const note of notes) {
					const yNote = new Y.Map();
					yNote.set('id', note.id);
					yNote.set('text', note.text);
					yNote.set('positionX', note.position.x);
					yNote.set('positionY', note.position.y);
					yNote.set('color', note.color || 'yellow');
					yNotes.set(note.id, yNote);
				}

				for (const comment of comments) {
					const yComment = new Y.Map();
					yComment.set('id', comment.id);
					yComment.set('targetId', comment.targetId);
					yComment.set('targetType', comment.targetType);
					yComment.set('text', comment.text);
					yComment.set('authorName', comment.authorName);
					yComment.set('createdAt', comment.createdAt);
					yComment.set('resolved', comment.resolved ?? false);
					yComment.set('parentId', comment.parentId ?? null);
					yComments.set(comment.id, yComment);
				}

				for (const node of flowNodes) {
					const yNode = new Y.Map();
					yNode.set('id', node.id);
					yNode.set('name', node.name);
					yNode.set('type', node.type);
					yNode.set('positionX', node.position.x);
					yNode.set('positionY', node.position.y);
					if (node.color) yNode.set('color', node.color);
					yFlowNodes.set(node.id, yNode);
				}

				for (const edge of flowEdges) {
					const yEdge = new Y.Map();
					yEdge.set('id', edge.id);
					yEdge.set('label', edge.label);
					yEdge.set('fromNodeId', edge.fromNodeId);
					yEdge.set('toNodeId', edge.toNodeId);
					if (edge.condition) yEdge.set('condition', edge.condition);
					if (edge.fromSide) yEdge.set('fromSide', edge.fromSide);
					if (edge.toSide) yEdge.set('toSide', edge.toSide);
					for (const key of ['labelOffset', 'waypoints', 'lineStyle', 'strokeWidth', 'strokeDash', 'edgeColor', 'arrowHead', 'arrowDirection', 'startArrow', 'endArrow', 'routingMode'] as const) { if (edge[key] !== undefined) yEdge.set(key, edge[key]); }
					yFlowEdges.set(edge.id, yEdge);
				}

				for (const node of dfdNodes) {
					const yNode = new Y.Map();
					yNode.set('id', node.id);
					yNode.set('name', node.name);
					yNode.set('type', node.type);
					yNode.set('positionX', node.position.x);
					yNode.set('positionY', node.position.y);
					if (node.processNumber) yNode.set('processNumber', node.processNumber);
				for (const key of ['width', 'height', 'storeNumber', 'boundarySourceId'] as const) if (node[key] !== undefined) yNode.set(key, node[key]);
					if (node.color) yNode.set('color', node.color);
					yDFDNodes.set(node.id, yNode);
				}

				for (const flow of dfdFlows) {
					const yFlow = new Y.Map();
					yFlow.set('id', flow.id);
					yFlow.set('label', flow.label);
				if (flow.boundaryFlowId) yFlow.set('boundaryFlowId', flow.boundaryFlowId);
					yFlow.set('fromNodeId', flow.fromNodeId);
					yFlow.set('toNodeId', flow.toNodeId);
					yDFDFlows.set(flow.id, yFlow);
				}

				yMeta.set('notation', notation);
				yMeta.set('diagramFont', font);
				yMeta.set('diagramFontSize', String(diagram.diagramFontSize));
				yMeta.set('diagramType', diagram.diagramType);
				if (diagram.customFonts.length > 0) {
					yMeta.set('customFonts', JSON.stringify(snap(diagram.customFonts)));
				}

				if (_session?.activeDiagramId) {
					const activeDiagram = (_session as any).diagrams?.find?.((d: any) => d.id === _session!.activeDiagramId);
					if (activeDiagram?.name) {
						yMeta.set('diagramName', activeDiagram.name);
					}
				}
			});
		} finally {
			this.suppressLocalPush = false;
		}
	}



	private applyRemoteEntities(yEntities: Y.Map<unknown>) {

		if (diagram.animating) {

			const remoteIds = new Set<string>();
			const newEntities: Entity[] = [];
			yEntities.forEach((value) => {
				const yEntity = value as Y.Map<unknown>;
				const id = yEntity.get('id') as string;
				remoteIds.add(id);
				if (!diagram.entities.find(e => e.id === id)) {
					const attrs: Attribute[] = JSON.parse((yEntity.get('attributes') as string) || '[]');
					const isLocked = yEntity.get('isLocked') as boolean | undefined;
					const sampleRowsRaw = yEntity.get('sampleRows') as string | undefined;
					newEntities.push({
						id,
						name: yEntity.get('name') as string,
						isWeak: yEntity.get('isWeak') as boolean,
						position: { x: yEntity.get('positionX') as number, y: yEntity.get('positionY') as number },
						attributes: attrs,
						...(sampleRowsRaw ? { sampleRows: JSON.parse(sampleRowsRaw) } : {}),
						...(isLocked ? { isLocked } : {})
					});
				}
			});

			if (newEntities.length > 0) {
				diagram.entities = [...diagram.entities, ...newEntities];
				diagram.newEntityIds = new Set([...diagram.newEntityIds, ...newEntities.map(e => e.id)]);
				setTimeout(() => {
					diagram.newEntityIds = new Set(
						[...diagram.newEntityIds].filter(id => !newEntities.some(e => e.id === id))
					);
				}, 600);
			}

			const removed = diagram.entities.filter(e => !remoteIds.has(e.id));
			if (removed.length > 0) {
				this.triggerDyingEntities(removed);
				diagram.entities = diagram.entities.filter(e => remoteIds.has(e.id));
			}
			return;
		}

		const entities: Entity[] = [];
		yEntities.forEach((value) => {
			const yEntity = value as Y.Map<unknown>;
			const attrs: Attribute[] = JSON.parse((yEntity.get('attributes') as string) || '[]');
			const isLocked = yEntity.get('isLocked') as boolean | undefined;
			const color = yEntity.get('color') as string | undefined;
			const fontSize = yEntity.get('fontSize') as number | undefined;
			const bold = yEntity.get('bold') as boolean | undefined;
			const italic = yEntity.get('italic') as boolean | undefined;
			const sampleRowsRaw = yEntity.get('sampleRows') as string | undefined;
			entities.push({
				id: yEntity.get('id') as string,
				name: yEntity.get('name') as string,
				isWeak: yEntity.get('isWeak') as boolean,
				position: {
					x: yEntity.get('positionX') as number,
					y: yEntity.get('positionY') as number
				},
				attributes: attrs,
				...(sampleRowsRaw ? { sampleRows: JSON.parse(sampleRowsRaw) } : {}),
				...(isLocked ? { isLocked } : {}),
				...(color ? { color } : {}),
				...(fontSize !== undefined ? { fontSize } : {}),
				...(bold !== undefined ? { bold } : {}),
				...(italic !== undefined ? { italic } : {})
			});
		});


		const oldIds = new Set(diagram.entities.map(e => e.id));
		const newIds = entities.filter(e => !oldIds.has(e.id)).map(e => e.id);
		if (newIds.length > 0) {
			diagram.newEntityIds = new Set([...diagram.newEntityIds, ...newIds]);
			setTimeout(() => {
				diagram.newEntityIds = new Set(
					[...diagram.newEntityIds].filter(id => !newIds.includes(id))
				);
			}, 600);
		}


		const remoteIds = new Set(entities.map(e => e.id));
		const removedEnts = diagram.entities.filter(e => !remoteIds.has(e.id));
		if (removedEnts.length > 0) {
			this.triggerDyingEntities(removedEnts);
		}

		diagram.entities = entities;
	}


	private triggerDyingEntities(removed: Entity[]) {
		const dyingEnts = removed.map(e => {
			const box = diagram.estimateEntityBox(e);
			return { ...e, _dyingRect: { x: e.position.x, y: e.position.y, width: box.w, height: box.h } };
		});
		diagram.dyingEntities = [...diagram.dyingEntities, ...dyingEnts];
		const dyingIds = new Set(removed.map(e => e.id));
		setTimeout(() => {
			diagram.dyingEntities = diagram.dyingEntities.filter(e => !dyingIds.has(e.id));
		}, 900);
	}

	private applyRemoteRelationships(yRelationships: Y.Map<unknown>) {
		const relationships: Relationship[] = [];
		yRelationships.forEach((value) => {
			const yRel = value as Y.Map<unknown>;
			relationships.push({
				id: yRel.get('id') as string,
				name: yRel.get('name') as string,
				entityIds: JSON.parse(yRel.get('entityIds') as string) as [string, string],
				cardinalities: JSON.parse(yRel.get('cardinalities') as string) as [CardinalityType, CardinalityType],
				isIdentifying: yRel.get('isIdentifying') as boolean,
				labelOffset: yRel.get('labelOffset') as Relationship['labelOffset'],
				fromCardinalityOffset: yRel.get('fromCardinalityOffset') as Relationship['fromCardinalityOffset'],
				toCardinalityOffset: yRel.get('toCardinalityOffset') as Relationship['toCardinalityOffset'],
				fromAnchor: yRel.get('fromAnchor') as Relationship['fromAnchor'],
				toAnchor: yRel.get('toAnchor') as Relationship['toAnchor'],
				diamondPosition: yRel.get('diamondPosition') as Relationship['diamondPosition'],
				waypoints: yRel.get('waypoints') as Relationship['waypoints'],
				fromWaypoints: yRel.get('fromWaypoints') as Relationship['fromWaypoints'],
				toWaypoints: yRel.get('toWaypoints') as Relationship['toWaypoints'],
				dataFlowDirection: yRel.get('dataFlowDirection') as Relationship['dataFlowDirection']
			});
		});


		const oldIds = new Set(diagram.relationships.map(r => r.id));
		const newIds = relationships.filter(r => !oldIds.has(r.id)).map(r => r.id);
		if (newIds.length > 0) {
			diagram.newRelationshipIds = new Set([...diagram.newRelationshipIds, ...newIds]);
			setTimeout(() => {
				diagram.newRelationshipIds = new Set(
					[...diagram.newRelationshipIds].filter(id => !newIds.includes(id))
				);
			}, 3500);
		}


		const remoteIds = new Set(relationships.map(r => r.id));

		const removedRels = diagram.relationships.filter(r =>
			!remoteIds.has(r.id) && !diagram.dyingRelationshipIds.has(r.id)
		);
		if (removedRels.length > 0) {


			const entityIds = new Set(diagram.entities.map(e => e.id));
			const canAnimate = removedRels.filter(r =>
				entityIds.has(r.entityIds[0]) && entityIds.has(r.entityIds[1])
			);
			const instantRemove = removedRels.filter(r =>
				!entityIds.has(r.entityIds[0]) || !entityIds.has(r.entityIds[1])
			);

			if (canAnimate.length > 0) {
				const removedIds = canAnimate.map(r => r.id);
				diagram.dyingRelationshipIds = new Set([...diagram.dyingRelationshipIds, ...removedIds]);

				diagram.relationships = [...relationships, ...canAnimate];
				setTimeout(() => {
					diagram.relationships = diagram.relationships.filter(r => !removedIds.includes(r.id));
					diagram.dyingRelationshipIds = new Set(
						[...diagram.dyingRelationshipIds].filter(id => !removedIds.includes(id))
					);
				}, 2500);
			} else {
				diagram.relationships = relationships;
			}
		} else {
			diagram.relationships = relationships;
		}
	}

	get shareUrl(): string {
		if (!this.roomId || typeof window === 'undefined') return '';
		const url = new URL(window.location.href);
		url.searchParams.set('room', this.roomId);
		if (this.roomToken) {
			url.searchParams.set('token', this.roomToken);
		}
		return url.toString();
	}
}

export const collab = new CollabState();


registerCollab(collab);


import { registerCollab as registerAutoSaveCollab } from './auto-save.svelte';
registerAutoSaveCollab(collab);
