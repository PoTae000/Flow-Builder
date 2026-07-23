import * as Y from 'yjs';
import { UndoManager } from 'yjs';
// @ts-ignore — y-webrtc has no type declarations
import { WebrtcProvider } from 'y-webrtc';
import { diagram, registerCollab } from './diagram.svelte';
import { auth } from './auth.svelte';
import { PUBLIC_SIGNALING_URL } from '$env/static/public';
import type { Entity, Attribute, Relationship, CardinalityType, Note } from '$lib/types/er';
import type { NotationStyle } from '$lib/types/notation';
import type { FlowNode, FlowEdge } from '$lib/types/flowchart';
import type { AgentAction } from '$lib/types/agent';
import type { DFDNode, DFDFlow } from '$lib/types/context-diagram';
import { safeSave } from '$lib/utils/storage';
import { snap } from './collab-utils';
import { toast } from './toast.svelte';
import * as permissions from './collab-permissions.svelte';
import * as chat from './collab-chat.svelte';
import * as presentation from './collab-presentation.svelte';
import { voiceChat } from './voice-chat.svelte';

export interface CollabUser {
	id: number;
	name: string;
	color: string;
	picture: string;
	cursor?: { x: number; y: number };
}

export type PermissionAction = 'import' | 'ai-analysis' | 'translate' | 'auto-layout'
	| 'presentation' | 'change-notation' | 'change-font'
	| 'domain-starter' | 'templates' | 'physics';

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

// Lazy import to avoid circular dep — set from +page.svelte
let _session: { renameDiagram: (id: string, name: string) => void; activeDiagramId: string | null } | null = null;
export function registerSession(s: typeof _session) {
	_session = s;
}

export class CollabState {
	connected = $state(false);
	roomId = $state('');
	roomToken = $state('');
	users = $state<CollabUser[]>([]);
	userName = $state('');
	userPicture = $state('');
	synced = $state(false);
	peerCount = $state(0);
	/** Whether this client created the room (host) */
	isHost = $state(false);
	/** Protects isHost from being overridden by stale Y.js meta during sync race */
	private _joinedAsHost = false;
	/** The host's awareness client ID */
	private hostClientId: number | null = null;
	/** Storage event listener for cross-tab leave signals */
	private storageListener: ((e: StorageEvent) => void) | null = null;

	// Permission voting state
	permissionRequest = $state<PermissionRequest | null>(null);
	permissionVotes = $state<Map<number, 'approve' | 'deny'>>(new Map());
	localClientId = $state<number>(-1);
	/** Host-granted permissions: clientId → set of actions they can do without voting */
	permissionGrants = $state<Map<number, Set<PermissionAction>>>(new Map());
	_permissionResolver: ((result: boolean) => void) | null = null;
	_permissionTimeout: ReturnType<typeof setTimeout> | null = null;

	/** Remote cursor positions — updated separately from users for high-frequency reactivity */
	cursorMap = $state<Map<number, { x: number; y: number; name: string; color: string }>>(new Map());

	/** Remote user selections — maps clientId → { entityIds, color, name } */
	remoteSelections = $state<Map<number, { entityIds: string[]; color: string; name: string }>>(new Map());

	/** O(1) lookup: entityId → list of remote selectors */
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

	// Shared chat state
	chatMessages = $state<ChatMessage[]>([]);
	_suppressChatSync = false;
	_chatBackup: ChatMessage[] = [];


	// Shared presentation state
	presentationActive = $state(false);
	presentationStep = $state(0);
	presenterId = $state<number>(-1);
	presentationPanX = $state(0);
	presentationPanY = $state(0);
	presentationZoom = $state(1);

	// Last save info
	lastSaveUserName = $state<string | null>(null);
	lastSaveUserPicture = $state<string | null>(null);
	lastSaveTimestamp = $state<number | null>(null);

	_doc: Y.Doc | null = null;
	_provider: WebrtcProvider | null = null;
	_undoManager: UndoManager | null = null;
	suppressLocalPush = false;
	private syncFallbackTimer: ReturnType<typeof setTimeout> | null = null;
	/** Debounce conflict toasts per entity (max 1 per 3s) */
	private _conflictToastTimers = new Map<string, number>();
	/** Track last applied layout timestamp to prevent duplicate triggers */
	private _lastLayoutTs = 0;
	/** Track last applied notation timestamp to prevent duplicate triggers */
	private _lastNotationTs = 0;
	/** Track last applied physics timestamp to prevent duplicate triggers */
	private _lastPhysicsTs = 0;
	/** Lerp targets for smooth remote physics rendering */
	private _physicsLerpTargets = new Map<string, { x: number; y: number }>();
	private _physicsLerpFrameId = 0;
	/** Lerp targets for smooth remote drag rendering */
	private _dragLerpTargets = new Map<string, { x: number; y: number }>();
	private _dragLerpFrameId = 0;
	/** Per-client timestamp to detect stale drag awareness updates */
	private _lastDragTs = new Map<number, number>();
	/** Timer to detect empty/closed rooms for joiners */
	private _emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;

	// Listener references for cleanup (prevents memory leak)
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
		flowNodesObserver?: Function;
		flowEdgesObserver?: Function;
		dfdNodesObserver?: Function;
		dfdFlowsObserver?: Function;
		providerSynced?: Function;
		providerPeers?: Function;
	} = {};

	/** Load user info — prefer Google profile, fallback to localStorage */
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

	/** Save room info to localStorage for auto-rejoin on refresh */
	private saveRoomInfo() {
		if (typeof localStorage !== 'undefined') {
			safeSave('collab-room', JSON.stringify({
				roomId: this.roomId,
				roomToken: this.roomToken,
				isHost: this.isHost
			}));
		}
	}

	/** Clear saved room info */
	private clearRoomInfo() {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem('collab-room');
		}
	}

	/** Try to rejoin a previously saved room (after page refresh) */
	tryRejoin(): boolean {
		if (typeof localStorage === 'undefined') return false;
		const raw = localStorage.getItem('collab-room');
		if (!raw) return false;
		try {
			const { roomId, roomToken, isHost } = JSON.parse(raw);
			if (roomId) {
				// Legacy rooms saved without token — generate one (host) or clear (joiner)
				const token = roomToken || (isHost ? generateRoomToken() : '');
				if (!token) {
					// Joiner without token can't rejoin — clear stale data
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
		const id = generateRoomId();
		const token = generateRoomToken();
		this.isHost = true;
		this.joinRoom(id, true, token);
	}

	joinRoom(roomId: string, asHost = false, token?: string) {
		this.leaveRoom(true); // silent leave (don't clear diagram)
		this.roomId = roomId;
		this.roomToken = token || '';
		this.isHost = asHost;
		this._joinedAsHost = asHost;

		// Use Google profile if available
		if (auth.user) {
			this.userName = auth.user.name;
			this.userPicture = auth.user.picture;
		}

		// Setup cross-tab leave signal listener
		this.setupStorageListener();

		this._doc = new Y.Doc();

		// Use MULTIPLE signaling servers so a cold-started/asleep primary
		// (Render free tier sleeps after 15 min → first join fails until it
		// wakes) doesn't block joining — peers can rendezvous on any shared
		// server. Public y-webrtc servers act as always-on fallbacks.
		const signalingServers = [
			...(PUBLIC_SIGNALING_URL ? [PUBLIC_SIGNALING_URL] : []),
			'wss://signaling.yjs.dev',
			'wss://y-webrtc-signaling-eu.herokuapp.com',
			'wss://y-webrtc-signaling-us.herokuapp.com'
		];
		// Topic: if no token provided, use room ID only (public room)
		// If token provided, include it for private room
		const topic = this.roomToken
			? `er-diagram-${roomId}-${this.roomToken}`
			: `er-diagram-${roomId}`;
		this._provider = new WebrtcProvider(topic, this._doc, {
			signaling: signalingServers
		});

		this.connected = true;
		this.synced = false;

		const provider = this._provider;

		// Set awareness info
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

		// Initialize voice chat
		voiceChat.connect(this._doc, this.localClientId);

		// Watch awareness changes for user list (store ref for cleanup)
		const updateUsers = () => {
			const states = awareness.getStates() as Map<number, { user?: { name: string; color: string; picture: string; userId?: string }; cursor?: { x: number; y: number } | null; selection?: string[]; lastEdit?: { entityId: string; timestamp: number } }>;
			const list: CollabUser[] = [];
			const seenUserIds = new Set<string>();
			const newSelections = new Map<number, { entityIds: string[]; color: string; name: string }>();

			states.forEach((state, clientId) => {
				if (state.user) {
					// Use userId (Google sub) if it exists and is non-empty, otherwise use anon-{clientId}
					const userId = (state.user.userId && state.user.userId.trim().length > 0)
						? state.user.userId.trim()
						: `anon-${clientId}`;

					// Skip if we've already seen this userId (duplicate user in multiple tabs)
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

					// Track remote selections (skip self)
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

			// Cancel empty-room timer once we see other peers
			if (list.length > 1 && this._emptyRoomTimer) {
				clearTimeout(this._emptyRoomTimer);
				this._emptyRoomTimer = null;
			}

			// Re-check permission result when users change (disconnect = auto-approve)
			if (this.permissionRequest && this._permissionResolver &&
				this.permissionRequest.requesterClientId === this.localClientId) {
				permissions.checkPermissionResult(this, this.permissionRequest, this.permissionVotes);
			}

			// If the requester disconnected, clear the permission request locally
			if (this.permissionRequest &&
				this.permissionRequest.requesterClientId !== this.localClientId &&
				!list.find(u => u.id === this.permissionRequest!.requesterClientId)) {
				this.permissionRequest = null;
				this.permissionVotes = new Map();
			}

			// If host disconnected, check if they reconnected with new clientID (e.g. page refresh)
			// Never auto-kick — host can still manually kick via kickUser()
			if (this.hostClientId !== null &&
				this.hostClientId !== awareness.clientID) {
				const hostGone = !list.find(u => u.id === this.hostClientId);
				if (hostGone) {
					// Check Y.js meta for updated hostClientId (host may have refreshed)
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

		// Dedicated cursor listener — updates cursorMap separately for fast reactivity
		const updateCursors = () => {
			const states = awareness.getStates() as Map<number, { user?: { name: string; color: string; userId?: string }; cursor?: { x: number; y: number } | null }>;
			const newMap = new Map<number, { x: number; y: number; name: string; color: string }>();
			const seenUserIds = new Set<string>();

			states.forEach((state, clientId) => {
				if (clientId !== awareness.clientID && state.user && state.cursor) {
					// Use userId (Google sub) if it exists and is non-empty, otherwise use anon-{clientId}
					const userId = (state.user.userId && state.user.userId.trim().length > 0)
						? state.user.userId.trim()
						: `anon-${clientId}`;

					// Skip duplicate cursors from same user in multiple tabs
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

		// Listen for remote layout intent via awareness (instant P2P)
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

		// Listen for remote notation change via awareness (instant P2P)
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

		// Listen for remote physics simulation via awareness (lerp interpolation)
		const physicsLerp = () => {
			if (this._physicsLerpTargets.size === 0) {
				this._physicsLerpFrameId = 0;
				return;
			}
			const LERP_FACTOR = 0.35;
			let anyMoving = false;
			for (const [id, target] of this._physicsLerpTargets) {
				// Skip entities the local user is actively dragging
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
						// Start lerp loop if not running
						if (!this._physicsLerpFrameId) {
							this._physicsLerpFrameId = requestAnimationFrame(physicsLerp);
						}
					} else if (!state.physicsIntent.active) {
						// Physics stopped — snap to final + clear
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

		// Listen for remote drag positions via awareness (lerp interpolation)
		const dragLerp = () => {
			if (this._dragLerpTargets.size === 0) {
				this._dragLerpFrameId = 0;
				return;
			}
			const LERP_FACTOR = 0.35;
			let anyMoving = false;
			for (const [id, target] of this._dragLerpTargets) {
				// Skip entities the local user is actively dragging
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
							// Parse prefixed keys: 'flow:xxx' → flowNode, 'dfd:xxx' → dfdNode, else ER entity
							let nodeId = rawId;
							if (rawId.startsWith('flow:')) {
								nodeId = rawId.slice(5);
							} else if (rawId.startsWith('dfd:')) {
								nodeId = rawId.slice(4);
							}
							this._dragLerpTargets.set(nodeId, { x: pos.x, y: pos.y });
						}
						// Start lerp loop if not running
						if (!this._dragLerpFrameId) {
							this._dragLerpFrameId = requestAnimationFrame(dragLerp);
						}
					} else if (!state.dragIntent.active) {
						// Drag stopped — clear lerp targets
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

		// Listen for remote data flow toggle via awareness
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
				// Check local state from awareness
				const localState = awareness.getLocalState() as any;
				if (!localState?.dataFlowActive && diagram.showDataFlow) {
					diagram.showDataFlow = false;
				}
			}
		};
		this._listeners.awarenessChangeDataFlow = updateDataFlow;
		awareness.on('change', updateDataFlow);

		// Setup Y.js shared types
		const yEntities = this._doc.getMap('entities');
		const yRelationships = this._doc.getMap('relationships');
		const yMeta = this._doc.getMap('meta');

		// Observe remote entity changes (with conflict detection)
		const entitiesObserver = (events: Y.YEvent<any>[]) => {
			if (this.suppressLocalPush) return;

			// Conflict detection: check if any changed entity is selected locally
			if (diagram.selectedNodeIds.length > 0) {
				const changedIds = new Set<string>();
				for (const event of events) {
					if (event.target === yEntities) {
						// Top-level map changes (add/delete)
						for (const key of event.changes.keys.keys()) {
							changedIds.add(key);
						}
					} else if (event.path.length >= 1) {
						// Nested changes (attribute within entity map)
						const entityKey = event.path[0] as string;
						if (entityKey) changedIds.add(entityKey);
					}
				}

				for (const entityId of changedIds) {
					if (diagram.selectedNodeIdSet.has(entityId)) {
						// Find who edited it via awareness lastEdit
						const now = Date.now();
						const lastToast = this._conflictToastTimers.get(entityId) ?? 0;
						if (now - lastToast < 3000) continue; // debounce
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

		// Observe remote relationship changes
		const relationshipsObserver = () => {
			if (this.suppressLocalPush) return;
			this.applyRemoteRelationships(yRelationships);
		};
		this._listeners.relationshipsObserver = relationshipsObserver;
		yRelationships.observeDeep(relationshipsObserver);

		// Observe meta changes (notation, font, diagramName, kicked users)
		const metaObserver = () => {
			if (this.suppressLocalPush) return;
			const notation = yMeta.get('notation') as NotationStyle | undefined;
			if (notation && notation !== diagram.notation && !diagram.notationTransitioning && !diagram.notationAppearing) {
				// Only apply if not already transitioning (awareness-based intent already started it)
				diagram.setNotation(notation, true);
			}
			const font = yMeta.get('diagramFont') as string | undefined;
			if (font && font !== diagram.diagramFont) {
				diagram.diagramFont = font;
			}
			// Sync custom fonts
			const customFontsRaw = yMeta.get('customFonts') as string | undefined;
			if (customFontsRaw) {
				try {
					const remoteFonts = JSON.parse(customFontsRaw);
					if (Array.isArray(remoteFonts) && JSON.stringify(remoteFonts) !== JSON.stringify(diagram.customFonts)) {
						diagram.customFonts = remoteFonts;
						// Re-inject <link> tags for any new custom fonts
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
			// Sync diagram tab name
			const diagramName = yMeta.get('diagramName') as string | undefined;
			if (diagramName && _session?.activeDiagramId) {
				_session.renameDiagram(_session.activeDiagramId, diagramName);
			}
			// Check host info — skip if we explicitly joined as host
			// (prevents stale hostClientId from previous session overriding isHost)
			const hostId = yMeta.get('hostClientId') as number | undefined;
			if (hostId !== undefined) {
				this.hostClientId = hostId;
				if (!this._joinedAsHost) {
					this.isHost = awareness.clientID === hostId;
				}
			}
			// Sync presentation state
			const presActiveRaw = yMeta.get('presentationActive') as string | undefined;
			if (presActiveRaw !== undefined) {
				const active = presActiveRaw === 'true';
				if (active !== this.presentationActive) {
					this.presentationActive = active;
				}
			}
			const presStepRaw = yMeta.get('presentationStep') as string | undefined;
			if (presStepRaw !== undefined) {
				const step = parseInt(presStepRaw, 10);
				if (!isNaN(step) && step !== this.presentationStep) {
					this.presentationStep = step;
				}
			}
			const presenterIdRaw = yMeta.get('presenterId') as string | undefined;
			if (presenterIdRaw !== undefined) {
				this.presenterId = parseInt(presenterIdRaw, 10);
			}
			// Sync presenter's view (only for viewers) — center-based coordinates
			if (this.presentationActive && this.presenterId !== this.localClientId) {
				const cx = yMeta.get('presentationCenterX') as string | undefined;
				const cy = yMeta.get('presentationCenterY') as string | undefined;
				const pz = yMeta.get('presentationZoom') as string | undefined;
				if (cx !== undefined && cy !== undefined && pz !== undefined) {
					const centerX = parseFloat(cx);
					const centerY = parseFloat(cy);
					const zoom = parseFloat(pz);
					// Convert center-based coordinates to this viewer's panX/panY
					const screenW = diagram.canvasWidth || window.innerWidth;
					const screenH = diagram.canvasHeight || window.innerHeight;
					this.presentationZoom = zoom;
					this.presentationPanX = screenW / 2 - centerX * zoom;
					this.presentationPanY = screenH / 2 - centerY * zoom;
					// Apply to diagram
					diagram.panX = this.presentationPanX;
					diagram.panY = this.presentationPanY;
					diagram.zoom = this.presentationZoom;
				}
			}

			// Sync last save info
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

			// Check if host dismissed the room (all joiners should leave)
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

			// Check if this client was kicked
			// Kick data includes host's clientID so stale kicks from
			// previous host sessions (e.g. after host refresh) are ignored
			const kickedRaw = yMeta.get('kicked') as string | undefined;
			if (kickedRaw) {
				try {
					const parsed = JSON.parse(kickedRaw);
					const currentHostId = yMeta.get('hostClientId') as number | undefined;
					const hostInAwareness = currentHostId !== undefined &&
						awareness.getStates().has(currentHostId);

					if (parsed && typeof parsed === 'object' && 'by' in parsed) {
						// New format { by: hostClientId, ids: [kickedClientIds] }
						// Only process if kick was issued by the CURRENT host session
						const byHost = parsed as { by: number; ids: number[] };
						if (byHost.by === currentHostId && hostInAwareness &&
							byHost.ids.includes(awareness.clientID)) {
							setTimeout(() => this.leaveRoom(), 0);
						}
					} else if (Array.isArray(parsed)) {
						// Legacy format (number[]): only process if host is connected
						if (hostInAwareness && parsed.includes(awareness.clientID)) {
							setTimeout(() => this.leaveRoom(), 0);
						}
					}
				} catch { /* invalid kicked data — ignore */ }
			}
		};
		this._listeners.metaObserver = metaObserver;
		yMeta.observe(metaObserver);

		// Observe permission changes
		const yPermissions = this._doc.getMap('permissions');
		const permissionsObserver = () => {
			this.syncPermissionState(yPermissions);
		};
		this._listeners.permissionsObserver = permissionsObserver;
		yPermissions.observe(permissionsObserver);

		// Observe shared chat messages
		const yChat = this._doc.getArray('chat');
		const chatObserver = () => {
			if (this._suppressChatSync) return;
			this.chatMessages = yChat.toArray() as ChatMessage[];
		};
		this._listeners.chatObserver = chatObserver;
		yChat.observe(chatObserver);

		// Observe shared notes
		const yNotes = this._doc.getMap('notes');
		const notesObserver = () => {
			if (this.suppressLocalPush) return;
			this.applyRemoteNotes(yNotes);
		};
		this._listeners.notesObserver = notesObserver;
		yNotes.observeDeep(notesObserver);

		// Observe shared flowchart data
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

		// Observe shared DFD data
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

		// Setup Y.js UndoManager — tracks only diagram data (not meta)
		// so undo reverses only this client's entity/relationship/note/flow/dfd changes
		this._undoManager = new UndoManager(
			[yEntities, yRelationships, yNotes, yFlowNodes, yFlowEdges, yDFDNodes, yDFDFlows],
			{ captureTimeout: 500 }
		);

		// Listen for sync event
		const syncedHandler = ({ synced }: { synced: boolean }) => {
			if (synced) {
				this.synced = true;
				if (yEntities.size === 0 && diagram.entities.length > 0) {
					this.pushFullState();
				}
				// Read host info after sync (same guard as meta observer)
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

		// Push state: host always pushes, joiner only if remote is empty
		if (asHost) {
			// Host: set host info, clear stale kicked list, push full state
			this.suppressLocalPush = true;
			try {
				yMeta.set('hostClientId', awareness.clientID);
				yMeta.delete('kicked'); // Clear old kicked list from previous session
				yMeta.delete('hostDismissed'); // Clear stale dismiss signal from previous session
			} finally {
				this.suppressLocalPush = false;
			}
			this.pushFullState();
		}

		// Track peer connections
		const peersHandler = ({ webrtcPeers }: { webrtcPeers: string[] }) => {
			if (webrtcPeers.length > 0 && !this.synced) {
				this.synced = true;
			}
		};
		this._listeners.providerPeers = peersHandler;
		provider.on('peers', peersHandler);

		// Save room info for auto-rejoin on refresh
		this.saveRoomInfo();

		// For non-host joiners: detect empty/closed rooms after timeout
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

	/** Setup storage listener for cross-tab leave signals */
	private setupStorageListener() {
		// Remove old listener if exists
		if (this.storageListener && typeof window !== 'undefined') {
			window.removeEventListener('storage', this.storageListener);
		}

		// Create new listener
		if (typeof window !== 'undefined') {
			this.storageListener = (e: StorageEvent) => {
				// Only handle collab-leave-signal events
				if (e.key === 'collab-leave-signal' && e.newValue) {
					try {
						const signal = JSON.parse(e.newValue);
						const myUserId = auth.user?.sub || '';

						// If this leave signal is for my userId, leave the room
						if (signal.userId && signal.userId === myUserId && myUserId !== '') {
							// Small delay to avoid race condition with the tab that initiated the leave
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

	/** Leave the room. If silent=true, don't clear diagram (used internally before rejoin) */
	leaveRoom(silent = false) {
		const wasJoiner = this.connected && !this.isHost;
		const wasHost = this.connected && this.isHost;
		const wasConnectedWithOthers = this.users.length > 1;

		// Broadcast leave signal to other tabs of the same user (only if not silent)
		if (!silent && typeof localStorage !== 'undefined' && auth.user?.sub) {
			const leaveSignal = {
				userId: auth.user.sub,
				timestamp: Date.now()
			};
			try {
				localStorage.setItem('collab-leave-signal', JSON.stringify(leaveSignal));
				// Clear it immediately so it doesn't interfere with future joins
				setTimeout(() => {
					localStorage.removeItem('collab-leave-signal');
				}, 500);
			} catch {
				// Ignore localStorage errors
			}
		}

		// Snapshot host's diagram before cleanup (safety net against Y.js destruction callbacks)
		const hostBackup = wasHost ? {
			entities: snap(diagram.entities),
			relationships: snap(diagram.relationships),
			notes: snap(diagram.notes),
			notation: diagram.notation,
			diagramFont: diagram.diagramFont,
			diagramType: diagram.diagramType,
			flowNodes: snap(diagram.flowNodes),
			flowEdges: snap(diagram.flowEdges),
			dfdNodes: snap(diagram.dfdNodes),
			dfdFlows: snap(diagram.dfdFlows),
			customFonts: snap(diagram.customFonts),
		} : null;

		// Cancel empty-room timer
		if (this._emptyRoomTimer) {
			clearTimeout(this._emptyRoomTimer);
			this._emptyRoomTimer = null;
		}

		// Block stray Y.js observer callbacks during cleanup
		this.suppressLocalPush = true;

		// Cancel any pending permission request
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
		this.presentationActive = false;
		this.presentationStep = 0;
		this.presenterId = -1;
		this.presentationPanX = 0;
		this.presentationPanY = 0;
		this.presentationZoom = 1;
		if (this._presViewTimer) { clearTimeout(this._presViewTimer); this._presViewTimer = null; }
		if (this._cursorTimer) { clearTimeout(this._cursorTimer); this._cursorTimer = null; }
		this.cursorMap = new Map();
		this.remoteSelections = new Map();
		this.localClientId = -1;
		// Clear drag lerp state
		this._dragLerpTargets.clear();
		this._lastDragTs.clear();
		if (this._dragLerpFrameId) {
			cancelAnimationFrame(this._dragLerpFrameId);
			this._dragLerpFrameId = 0;
		}
		this.lastSaveUserName = null;
		this.lastSaveUserPicture = null;
		this.lastSaveTimestamp = null;

		// Disconnect voice chat
		voiceChat.disconnect();

		// Unregister all Y.js listeners before destroying (prevents memory leak)
		if (this._provider && this._doc) {
			const awareness = this._provider.awareness;

			// Awareness listeners
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

			// Y.Map/Y.Array observers
			const yEntities = this._doc.getMap('entities');
			const yRelationships = this._doc.getMap('relationships');
			const yMeta = this._doc.getMap('meta');
			const yPermissions = this._doc.getMap('permissions');
			const yChat = this._doc.getArray('chat');
			const yNotes = this._doc.getMap('notes');
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
			if (this._listeners.flowNodesObserver) yFlowNodes.unobserveDeep(this._listeners.flowNodesObserver as any);
			if (this._listeners.flowEdgesObserver) yFlowEdges.unobserveDeep(this._listeners.flowEdgesObserver as any);
			if (this._listeners.dfdNodesObserver) yDFDNodes.unobserveDeep(this._listeners.dfdNodesObserver as any);
			if (this._listeners.dfdFlowsObserver) yDFDFlows.unobserveDeep(this._listeners.dfdFlowsObserver as any);

			// Provider event listeners
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

		// Clear ?room= and ?token= from URL so page refresh won't auto-rejoin
		if (!silent && typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			if (url.searchParams.has('room') || url.searchParams.has('token')) {
				url.searchParams.delete('room');
				url.searchParams.delete('token');
				window.history.replaceState({}, '', url.pathname + (url.search || ''));
			}
		}

		// Remove storage listener
		if (this.storageListener && typeof window !== 'undefined') {
			window.removeEventListener('storage', this.storageListener);
			this.storageListener = null;
		}

		// Joiner leaving: clear the diagram (it belongs to the host)
		// Use wasConnectedWithOthers (captured before cleanup) since this.users is already cleared
		if (wasJoiner && !silent && wasConnectedWithOthers) {
			diagram.entities = [];
			diagram.relationships = [];
			diagram.flowNodes = [];
			diagram.flowEdges = [];
			diagram.dfdNodes = [];
			diagram.dfdFlows = [];
		}

		// Host leaving: restore diagram if it was cleared during cleanup
		if (hostBackup && hostBackup.entities.length > 0 && diagram.entities.length === 0) {
			diagram.entities = hostBackup.entities;
			diagram.relationships = hostBackup.relationships;
			diagram.notes = hostBackup.notes;
			diagram.notation = hostBackup.notation as NotationStyle;
			diagram.diagramFont = hostBackup.diagramFont;
			diagram.diagramType = hostBackup.diagramType as typeof diagram.diagramType;
			diagram.flowNodes = hostBackup.flowNodes;
			diagram.flowEdges = hostBackup.flowEdges;
			diagram.dfdNodes = hostBackup.dfdNodes;
			diagram.dfdFlows = hostBackup.dfdFlows;
			diagram.customFonts = hostBackup.customFonts;
		}

		// Reset suppressLocalPush so next joinRoom's observers work correctly
		this.suppressLocalPush = false;
	}

	/** Host dismisses the room — signals all joiners to leave, then host leaves */
	dismissRoom() {
		if (!this._doc || !this._provider || !this.isHost) {
			this.leaveRoom();
			return;
		}
		const yMeta = this._doc.getMap('meta');
		yMeta.set('hostDismissed', JSON.stringify({
			by: this._provider.awareness.clientID
		}));
		// Delay to let WebRTC propagate the signal to joiners before destroying
		setTimeout(() => this.leaveRoom(), 150);
	}

	/** Host kicks a user by their awareness client ID */
	kickUser(clientId: number) {
		if (!this._doc || !this.isHost || !this._provider) return;
		const yMeta = this._doc.getMap('meta');
		const myId = this._provider.awareness.clientID;
		// Read existing kick data (new format with host ID)
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

	/** Push diagram tab name to sync */
	pushDiagramName(name: string) {
		this.pushMeta('diagramName', name);
	}

	// --- Permission voting methods (delegated to collab-permissions helper) ---

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

	// --- Presentation sync methods (delegated to collab-presentation helper) ---

	pushPresentationStart() {
		presentation.pushPresentationStart(this);
	}

	pushPresentationStop() {
		presentation.pushPresentationStop(this);
	}

	pushPresentationStep(step: number) {
		presentation.pushPresentationStep(this, step);
	}

	_presViewTimer: ReturnType<typeof setTimeout> | null = null;
	private _cursorTimer: ReturnType<typeof setTimeout> | null = null;

	/** Broadcast local selection to awareness */
	updateSelection(ids: string[]) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('selection', ids);
	}

	/** Send local cursor position to awareness (throttled ~150ms) */
	updateCursor(x: number, y: number) {
		if (!this.connected || !this._provider) return;
		if (this._cursorTimer) return;
		this._cursorTimer = setTimeout(() => {
			this._cursorTimer = null;
		}, 150);
		this._provider.awareness.setLocalStateField('cursor', { x, y });
	}

	/** Clear local cursor from awareness (mouse left canvas) */
	clearCursor() {
		if (!this.connected || !this._provider) return;
		if (this._cursorTimer) {
			clearTimeout(this._cursorTimer);
			this._cursorTimer = null;
		}
		this._provider.awareness.setLocalStateField('cursor', null);
	}

	/** Broadcast layout intent via awareness (faster than Y.Doc meta) */
	broadcastLayout(positions: Record<string, { x: number; y: number }>) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('layoutIntent', { positions, ts: Date.now() });
		// Clear after animation window so it doesn't re-trigger on late joiners
		setTimeout(() => {
			this._provider?.awareness.setLocalStateField('layoutIntent', null);
		}, 1500);
	}

	/** Broadcast notation change intent via awareness (instant P2P) */
	broadcastNotation(notation: string) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('notationIntent', { notation, ts: Date.now() });
		setTimeout(() => {
			this._provider?.awareness.setLocalStateField('notationIntent', null);
		}, 2500);
	}

	/** Broadcast physics positions via awareness so all users see the simulation */
	broadcastPhysicsPositions(positions: Record<string, { x: number; y: number }>) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('physicsIntent', { positions, active: true, ts: Date.now() });
	}

	/** Broadcast that physics simulation stopped */
	broadcastPhysicsStop() {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('physicsIntent', { active: false, ts: Date.now() });
		setTimeout(() => {
			this._provider?.awareness.setLocalStateField('physicsIntent', null);
		}, 500);
	}

	/** Broadcast drag positions via awareness (lightweight, no CRDT overhead) */
	broadcastDragPositions(positions: Record<string, { x: number; y: number }>) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('dragIntent', { positions, active: true, ts: Date.now() });
	}

	/** Broadcast that drag stopped — signals remote clients to clear lerp targets */
	broadcastDragStop() {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('dragIntent', { active: false, ts: Date.now() });
		setTimeout(() => {
			this._provider?.awareness.setLocalStateField('dragIntent', null);
		}, 500);
	}

	/** Broadcast data flow toggle via awareness */
	broadcastDataFlow(active: boolean) {
		if (!this.connected || !this._provider) return;
		this._provider.awareness.setLocalStateField('dataFlowActive', active);
	}

	pushPresentationView(panX: number, panY: number, zoom: number) {
		presentation.pushPresentationView(this, panX, panY, zoom);
	}

	/** Broadcast that this user saved the diagram */
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

	/** Is this client the presenter? */
	get isPresenter(): boolean {
		return this.presenterId === this.localClientId;
	}

	/** Is this client a viewer (not presenter) during active presentation? */
	get isViewer(): boolean {
		return this.connected && this.presentationActive && this.presenterId !== this.localClientId;
	}

	// --- Chat sync methods (delegated to collab-chat helper) ---

	pushChatMessage(msg: ChatMessage) {
		chat.pushChatMessage(this, msg);
	}

	clearChat() {
		chat.clearChat(this);
	}

	/** Mark a chat action as applied (update Y.Array entry) */
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

	// --- Y.js UndoManager wrappers (collab-safe undo/redo) ---

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

	// --- Note sync methods ---

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

	// --- Flowchart sync methods ---

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
				color: y.get('color') as string | undefined
			});
		});

		// Detect new nodes (remote add) → trigger pop-in animation
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

		// Detect removed nodes (remote delete) → trigger dying animation
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
			edges.push(edge);
		});

		// Detect new edges (remote add) → trigger line-draw animation
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

	// --- DFD sync methods ---

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
				if (n.color) yNode.set('color', n.color);
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
				yFlow.set('fromNodeId', f.fromNodeId);
				yFlow.set('toNodeId', f.toNodeId);
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
				color: y.get('color') as string | undefined
			});
		});

		// Detect new nodes (remote add) → trigger pop-in animation
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

		// Detect removed nodes (remote delete) → trigger dying animation
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
				toNodeId: y.get('toNodeId') as string
			});
		});

		// Detect new flows (remote add) → trigger line-draw animation
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

	// --- Push methods (local → Y.Doc) ---
	// All push methods use transact() for consistent propagation and
	// deep-clone data to avoid Svelte 5 $state proxy issues with Y.js

	// snap() is now imported from collab-utils.ts

	/** Debounced full-state sync as safety net (catches any missed pushes) */
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
				if (e.isLocked) yEntity.set('isLocked', true);
				yEntities.set(e.id, yEntity);
			});
		} finally {
			this.suppressLocalPush = false;
		}
		// Broadcast last-edit info via awareness (for conflict detection)
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
		// Snapshot all data to strip Svelte 5 proxies
		// Filter out dying entities/relationships (they're kept locally for animation only)
		const entities = snap(diagram.entities);
		const dyingRelIds = diagram.dyingRelationshipIds;
		const relationships = snap(
			dyingRelIds.size > 0
				? diagram.relationships.filter(r => !dyingRelIds.has(r.id))
				: diagram.relationships
		);
		const notes = snap(diagram.notes);
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
				const yFlowNodes = this._doc!.getMap('flowNodes');
				const yFlowEdges = this._doc!.getMap('flowEdges');
				const yDFDNodes = this._doc!.getMap('dfdNodes');
				const yDFDFlows = this._doc!.getMap('dfdFlows');
				const yMeta = this._doc!.getMap('meta');

				// Clear stale entries
				yEntities.forEach((_: unknown, key: string) => {
					if (!entities.find((e: Entity) => e.id === key)) yEntities.delete(key);
				});
				yRelationships.forEach((_: unknown, key: string) => {
					if (!relationships.find((r: Relationship) => r.id === key)) yRelationships.delete(key);
				});
				yNotes.forEach((_: unknown, key: string) => {
					if (!notes.find((n: Note) => n.id === key)) yNotes.delete(key);
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
					if (node.color) yNode.set('color', node.color);
					yDFDNodes.set(node.id, yNode);
				}

				for (const flow of dfdFlows) {
					const yFlow = new Y.Map();
					yFlow.set('id', flow.id);
					yFlow.set('label', flow.label);
					yFlow.set('fromNodeId', flow.fromNodeId);
					yFlow.set('toNodeId', flow.toNodeId);
					yDFDFlows.set(flow.id, yFlow);
				}

				yMeta.set('notation', notation);
				yMeta.set('diagramFont', font);
				yMeta.set('diagramType', diagram.diagramType);
				if (diagram.customFonts.length > 0) {
					yMeta.set('customFonts', JSON.stringify(snap(diagram.customFonts)));
				}
				// Sync diagram tab name
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

	// --- Apply remote changes (Y.Doc → diagram) ---

	private applyRemoteEntities(yEntities: Y.Map<unknown>) {
		// Skip position-only updates while animating (animation will reach correct positions)
		if (diagram.animating) {
			// Still apply non-position changes (name, attributes, new/removed entities)
			const remoteIds = new Set<string>();
			const newEntities: Entity[] = [];
			yEntities.forEach((value) => {
				const yEntity = value as Y.Map<unknown>;
				const id = yEntity.get('id') as string;
				remoteIds.add(id);
				if (!diagram.entities.find(e => e.id === id)) {
					const attrs: Attribute[] = JSON.parse((yEntity.get('attributes') as string) || '[]');
					const isLocked = yEntity.get('isLocked') as boolean | undefined;
					newEntities.push({
						id,
						name: yEntity.get('name') as string,
						isWeak: yEntity.get('isWeak') as boolean,
						position: { x: yEntity.get('positionX') as number, y: yEntity.get('positionY') as number },
						attributes: attrs,
						...(isLocked ? { isLocked } : {})
					});
				}
			});
			// Add any genuinely new entities
			if (newEntities.length > 0) {
				diagram.entities = [...diagram.entities, ...newEntities];
				diagram.newEntityIds = new Set([...diagram.newEntityIds, ...newEntities.map(e => e.id)]);
				setTimeout(() => {
					diagram.newEntityIds = new Set(
						[...diagram.newEntityIds].filter(id => !newEntities.some(e => e.id === id))
					);
				}, 600);
			}
			// Remove deleted entities (with dying animation)
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
			entities.push({
				id: yEntity.get('id') as string,
				name: yEntity.get('name') as string,
				isWeak: yEntity.get('isWeak') as boolean,
				position: {
					x: yEntity.get('positionX') as number,
					y: yEntity.get('positionY') as number
				},
				attributes: attrs,
				...(isLocked ? { isLocked } : {})
			});
		});

		// Detect new entities (remote add) → trigger pop-in animation
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

		// Detect removed entities (remote delete) → trigger dying animation
		const remoteIds = new Set(entities.map(e => e.id));
		const removedEnts = diagram.entities.filter(e => !remoteIds.has(e.id));
		if (removedEnts.length > 0) {
			this.triggerDyingEntities(removedEnts);
		}

		diagram.entities = entities;
	}

	/** Trigger dying (fade-out) animation for removed entities */
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
				isIdentifying: yRel.get('isIdentifying') as boolean
			});
		});

		// Detect new relationships (remote add) → trigger line-draw animation
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

		// Detect removed relationships (remote delete) → trigger fade-out animation
		const remoteIds = new Set(relationships.map(r => r.id));
		// Skip already-dying relationships (prevent double-animation)
		const removedRels = diagram.relationships.filter(r =>
			!remoteIds.has(r.id) && !diagram.dyingRelationshipIds.has(r.id)
		);
		if (removedRels.length > 0) {
			// Only animate dying for relationships whose entities still exist
			// (if entity was deleted, just remove instantly — no ghost lines)
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
				// Keep animated relationships visible during undraw animation
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

// Register with diagram store to break circular dependency
registerCollab(collab);

// Register with auto-save store for save event broadcasting
import { registerCollab as registerAutoSaveCollab } from './auto-save.svelte';
registerAutoSaveCollab(collab);
