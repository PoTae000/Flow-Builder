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
import type { DFDNode, DFDFlow } from '$lib/types/context-diagram';
import { safeSave } from '$lib/utils/storage';
import { snap } from './collab-utils';
import * as permissions from './collab-permissions.svelte';
import * as chat from './collab-chat.svelte';
import * as presentation from './collab-presentation.svelte';

export interface CollabUser {
	id: number;
	name: string;
	color: string;
	picture: string;
	cursor?: { x: number; y: number };
}

export type PermissionAction = 'import' | 'ai-analysis' | 'translate' | 'auto-layout'
	| 'presentation' | 'change-notation' | 'change-font'
	| 'domain-starter' | 'templates';

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
}

const USER_COLORS = [
	'#f87171', '#fb923c', '#fbbf24', '#a3e635',
	'#34d399', '#22d3ee', '#60a5fa', '#a78bfa',
	'#f472b6', '#e879f9'
];

function generateRoomId(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < 8; i++) {
		id += chars[Math.floor(Math.random() * chars.length)];
	}
	return id;
}

// Lazy import to avoid circular dep — set from +page.svelte
let _session: { renameDiagram: (id: string, name: string) => void; activeDiagramId: string | null } | null = null;
export function registerSession(s: typeof _session) {
	_session = s;
}

export class CollabState {
	connected = $state(false);
	roomId = $state('');
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

	_doc: Y.Doc | null = null;
	_provider: WebrtcProvider | null = null;
	_undoManager: UndoManager | null = null;
	suppressLocalPush = false;
	private syncFallbackTimer: ReturnType<typeof setTimeout> | null = null;

	// Listener references for cleanup (prevents memory leak)
	private _listeners: {
		awarenessChange?: Function;
		awarenessChangeCursors?: Function;
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
			const { roomId, isHost } = JSON.parse(raw);
			if (roomId) {
				this.joinRoom(roomId, isHost);
				return true;
			}
		} catch { /* ignore */ }
		return false;
	}

	createRoom() {
		const id = generateRoomId();
		this.isHost = true;
		this.joinRoom(id, true);
	}

	joinRoom(roomId: string, asHost = false) {
		this.leaveRoom(true); // silent leave (don't clear diagram)
		this.roomId = roomId;
		this.isHost = asHost;
		this._joinedAsHost = asHost;

		// Use Google profile if available
		if (auth.user) {
			this.userName = auth.user.name;
			this.userPicture = auth.user.picture;
		}

		this._doc = new Y.Doc();

		const signalingUrl = PUBLIC_SIGNALING_URL || 'wss://signaling.yjs.dev';
		this._provider = new WebrtcProvider(`er-diagram-${roomId}`, this._doc, {
			signaling: [signalingUrl]
		});

		this.connected = true;
		this.synced = false;

		const provider = this._provider;

		// Set awareness info
		const colorIdx = Math.floor(Math.random() * USER_COLORS.length);
		const awareness = provider.awareness;
		this.localClientId = awareness.clientID;
		this.hostClientId = asHost ? awareness.clientID : null;

		awareness.setLocalStateField('user', {
			name: this.userName || 'Anonymous',
			color: USER_COLORS[colorIdx],
			picture: this.userPicture || ''
		});

		// Watch awareness changes for user list (store ref for cleanup)
		const updateUsers = () => {
			const states = awareness.getStates() as Map<number, { user?: { name: string; color: string; picture: string }; cursor?: { x: number; y: number } | null }>;
			const list: CollabUser[] = [];
			states.forEach((state, clientId) => {
				if (state.user) {
					list.push({
						id: clientId,
						name: state.user.name,
						color: state.user.color,
						picture: state.user.picture || '',
						cursor: state.cursor ?? undefined
					});
				}
			});
			this.users = list;
			this.peerCount = list.length;

			// Re-check permission result when users change (disconnect = auto-approve)
			if (this.permissionRequest && this._permissionResolver &&
				this.permissionRequest.requesterClientId === this.localClientId) {
				this.checkPermissionResult(this.permissionRequest, this.permissionVotes);
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
			const states = awareness.getStates() as Map<number, { user?: { name: string; color: string }; cursor?: { x: number; y: number } | null }>;
			const newMap = new Map<number, { x: number; y: number; name: string; color: string }>();
			states.forEach((state, clientId) => {
				if (clientId !== awareness.clientID && state.user && state.cursor) {
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

		// Setup Y.js shared types
		const yEntities = this._doc.getMap('entities');
		const yRelationships = this._doc.getMap('relationships');
		const yMeta = this._doc.getMap('meta');

		// Observe remote entity changes
		const entitiesObserver = () => {
			if (this.suppressLocalPush) return;
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
			if (notation && notation !== diagram.notation) {
				diagram.notation = notation;
			}
			const font = yMeta.get('diagramFont') as string | undefined;
			if (font && font !== diagram.diagramFont) {
				diagram.diagramFont = font;
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
	}

	/** Leave the room. If silent=true, don't clear diagram (used internally before rejoin) */
	leaveRoom(silent = false) {
		const wasJoiner = this.connected && !this.isHost;
		const wasHost = this.connected && this.isHost;

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
		} : null;

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
		this.localClientId = -1;

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
		this.users = [];
		this.isHost = false;
		this._joinedAsHost = false;
		this.hostClientId = null;
		if (this.syncFallbackTimer) {
			clearTimeout(this.syncFallbackTimer);
			this.syncFallbackTimer = null;
		}
		this.clearRoomInfo();

		// Joiner leaving: clear the diagram (it belongs to the host)
		if (wasJoiner && !silent) {
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

	pushPresentationView(panX: number, panY: number, zoom: number) {
		presentation.pushPresentationView(this, panX, panY, zoom);
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
		const entities = snap(diagram.entities);
		const relationships = snap(diagram.relationships);
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
		diagram.entities = entities;
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
		diagram.relationships = relationships;
	}

	get shareUrl(): string {
		if (!this.roomId || typeof window === 'undefined') return '';
		const url = new URL(window.location.href);
		url.searchParams.set('room', this.roomId);
		return url.toString();
	}
}

export const collab = new CollabState();

// Register with diagram store to break circular dependency
registerCollab(collab);
