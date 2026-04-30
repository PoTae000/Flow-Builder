import * as Y from 'yjs';
import type { CollabState, PermissionAction, PermissionRequest } from './collab.svelte';

/**
 * P2P Permission Voting System
 *
 * SECURITY NOTE (M5 — client-enforced permissions):
 * This permission model is enforced entirely on the client side via Y.js CRDT
 * state. It provides UX-level access control (preventing accidental actions)
 * but does NOT protect against adversarial clients. A malicious user who
 * modifies their client code can bypass all permission checks.
 *
 * This is an inherent limitation of P2P architecture — there is no central
 * authority to enforce permissions. True server-enforced access control would
 * require a relay server architecture instead of direct WebRTC P2P.
 *
 * Accepted risk: The collaboration feature targets trusted teams/classrooms,
 * not adversarial environments.
 */

/**
 * Request permission from all other users in the room. Returns true if approved.
 */
export function requestPermission(collab: CollabState, action: PermissionAction): Promise<boolean> {
	// Not in a room or alone → allow immediately
	if (!collab.connected || !collab._doc || collab.users.length <= 1) {
		return Promise.resolve(true);
	}

	// Check if this action was granted (host can grant to self too) → allow immediately
	if (hasGrant(collab, collab.localClientId, action)) {
		return Promise.resolve(true);
	}

	// Already a pending request → deny immediately
	if (collab.permissionRequest) {
		return Promise.resolve(false);
	}

	const awareness = collab._provider?.awareness;
	if (!awareness) return Promise.resolve(true);

	const myId = awareness.clientID;
	const voterIds = collab.users
		.filter(u => u.id !== myId)
		.map(u => u.id);

	if (voterIds.length === 0) return Promise.resolve(true);

	const me = collab.users.find(u => u.id === myId);
	const request: PermissionRequest = {
		id: crypto.randomUUID(),
		action,
		requesterClientId: myId,
		requesterName: (me?.name ?? collab.userName) || 'Anonymous',
		requesterPicture: (me?.picture ?? collab.userPicture) || '',
		voterClientIds: voterIds,
		createdAt: Date.now(),
	};

	// Write to Y.Map
	const yPerms = collab._doc.getMap('permissions');
	collab._doc.transact(() => {
		yPerms.set('request', JSON.stringify(request));
		// Clear any stale votes
		yPerms.forEach((_: unknown, key: string) => {
			if (key.startsWith('vote:')) yPerms.delete(key);
		});
	});

	return new Promise<boolean>((resolve) => {
		collab._permissionResolver = resolve;

		// Timeout after 60s
		collab._permissionTimeout = setTimeout(() => {
			resolvePermission(collab, false);
		}, 60000);
	});
}

/**
 * Submit a vote (for voters, not the requester).
 */
export function submitVote(collab: CollabState, vote: 'approve' | 'deny') {
	if (!collab._doc || !collab.permissionRequest) return;
	const yPerms = collab._doc.getMap('permissions');
	collab._doc.transact(() => {
		yPerms.set(`vote:${collab.localClientId}`, vote);
	});
}

/**
 * Cancel the current permission request (requester only).
 */
export function cancelPermissionRequest(collab: CollabState) {
	resolvePermission(collab, false);
}

/**
 * Host grants a specific permission to a user (no voting needed for that action).
 */
export function grantPermission(collab: CollabState, clientId: number, action: PermissionAction) {
	if (!collab._doc || !collab.isHost) return;
	const current = collab.permissionGrants.get(clientId);
	const actions = current ? [...current] : [];
	if (!actions.includes(action)) actions.push(action);
	pushGrants(collab, clientId, actions);
}

/**
 * Host revokes a previously granted permission.
 */
export function revokePermission(collab: CollabState, clientId: number, action: PermissionAction) {
	if (!collab._doc || !collab.isHost) return;
	const current = collab.permissionGrants.get(clientId);
	if (!current) return;
	const actions = [...current].filter(a => a !== action);
	pushGrants(collab, clientId, actions);
}

/**
 * Check if a user has been granted a specific permission by the host.
 */
export function hasGrant(collab: CollabState, clientId: number, action: PermissionAction): boolean {
	return collab.permissionGrants.get(clientId)?.has(action) ?? false;
}

/**
 * Write grant data to Y.Map.
 */
function pushGrants(collab: CollabState, clientId: number, actions: PermissionAction[]) {
	if (!collab._doc) return;
	const yPerms = collab._doc.getMap('permissions');
	collab._doc.transact(() => {
		yPerms.set(`grant:${clientId}`, JSON.stringify(actions));
	});
}

/**
 * Resolve the permission request with a result and clean up.
 */
export function resolvePermission(collab: CollabState, result: boolean) {
	if (collab._permissionTimeout) {
		clearTimeout(collab._permissionTimeout);
		collab._permissionTimeout = null;
	}
	const resolver = collab._permissionResolver;
	collab._permissionResolver = null;

	// Clear Y.Map
	clearPermissionRequest(collab);

	if (resolver) resolver(result);
}

/**
 * Clear permission request from Y.Map.
 */
function clearPermissionRequest(collab: CollabState) {
	if (!collab._doc) {
		collab.permissionRequest = null;
		collab.permissionVotes = new Map();
		return;
	}
	const yPerms = collab._doc.getMap('permissions');
	collab._doc.transact(() => {
		yPerms.set('request', 'null');
		yPerms.forEach((_: unknown, key: string) => {
			if (key.startsWith('vote:')) yPerms.delete(key);
		});
	});
}

/**
 * Sync permission state from Y.Map into reactive state.
 */
export function syncPermissionState(collab: CollabState, yPerms: Y.Map<unknown>) {
	// --- Sync grants ---
	const newGrants = new Map<number, Set<PermissionAction>>();
	yPerms.forEach((value: unknown, key: string) => {
		if (key.startsWith('grant:')) {
			const clientId = parseInt(key.slice(6), 10);
			try {
				const actions: PermissionAction[] = JSON.parse(value as string);
				if (actions.length > 0) newGrants.set(clientId, new Set(actions));
			} catch { /* ignore */ }
		}
	});
	collab.permissionGrants = newGrants;

	// --- Sync request & votes ---
	const rawReq = yPerms.get('request') as string | undefined;
	if (!rawReq || rawReq === 'null') {
		collab.permissionRequest = null;
		collab.permissionVotes = new Map();
		// If we were waiting and request got cleared externally, resolve false
		if (collab._permissionResolver) {
			resolvePermission(collab, false);
		}
		return;
	}

	try {
		const req: PermissionRequest = JSON.parse(rawReq);
		collab.permissionRequest = req;

		// Read votes
		const newVotes = new Map<number, 'approve' | 'deny'>();
		yPerms.forEach((value: unknown, key: string) => {
			if (key.startsWith('vote:')) {
				const clientId = parseInt(key.slice(5), 10);
				newVotes.set(clientId, value as 'approve' | 'deny');
			}
		});
		collab.permissionVotes = newVotes;

		// Check result if we are the requester
		if (req.requesterClientId === collab.localClientId && collab._permissionResolver) {
			checkPermissionResult(collab, req, newVotes);
		}
	} catch {
		collab.permissionRequest = null;
		collab.permissionVotes = new Map();
	}
}

/**
 * Check if voting is complete and resolve accordingly.
 */
export function checkPermissionResult(collab: CollabState, req: PermissionRequest, votes: Map<number, 'approve' | 'deny'>) {
	// Immediately deny if anyone voted deny
	for (const [, v] of votes) {
		if (v === 'deny') {
			resolvePermission(collab, false);
			return;
		}
	}

	// Check which voters are still connected
	const connectedUserIds = new Set(collab.users.map(u => u.id));
	let allResolved = true;
	for (const voterId of req.voterClientIds) {
		if (!connectedUserIds.has(voterId)) {
			// Disconnected → treat as auto-approve (skip)
			continue;
		}
		if (!votes.has(voterId)) {
			allResolved = false;
		}
	}

	if (allResolved) {
		resolvePermission(collab, true);
	}
}
