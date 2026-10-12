import * as Y from 'yjs';
import type { CollabState, PermissionAction, PermissionRequest } from './collab.svelte';




export function requestPermission(collab: CollabState, action: PermissionAction): Promise<boolean> {
	
	if (!collab.connected || !collab._doc || collab.users.length <= 1) {
		return Promise.resolve(true);
	}

	
	if (hasGrant(collab, collab.localClientId, action)) {
		return Promise.resolve(true);
	}

	
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

	
	const yPerms = collab._doc.getMap('permissions');
	collab._doc.transact(() => {
		yPerms.set('request', JSON.stringify(request));
		
		yPerms.forEach((_: unknown, key: string) => {
			if (key.startsWith('vote:')) yPerms.delete(key);
		});
	});

	return new Promise<boolean>((resolve) => {
		collab._permissionResolver = resolve;

		
		collab._permissionTimeout = setTimeout(() => {
			resolvePermission(collab, false);
		}, 60000);
	});
}


export function submitVote(collab: CollabState, vote: 'approve' | 'deny') {
	if (!collab._doc || !collab.permissionRequest) return;
	const yPerms = collab._doc.getMap('permissions');
	collab._doc.transact(() => {
		yPerms.set(`vote:${collab.localClientId}`, vote);
	});
}


export function cancelPermissionRequest(collab: CollabState) {
	resolvePermission(collab, false);
}


export function grantPermission(collab: CollabState, clientId: number, action: PermissionAction) {
	if (!collab._doc || !collab.isHost) return;
	const current = collab.permissionGrants.get(clientId);
	const actions = current ? [...current] : [];
	if (!actions.includes(action)) actions.push(action);
	pushGrants(collab, clientId, actions);
}


export function revokePermission(collab: CollabState, clientId: number, action: PermissionAction) {
	if (!collab._doc || !collab.isHost) return;
	const current = collab.permissionGrants.get(clientId);
	if (!current) return;
	const actions = [...current].filter(a => a !== action);
	pushGrants(collab, clientId, actions);
}


export function hasGrant(collab: CollabState, clientId: number, action: PermissionAction): boolean {
	return collab.permissionGrants.get(clientId)?.has(action) ?? false;
}


function pushGrants(collab: CollabState, clientId: number, actions: PermissionAction[]) {
	if (!collab._doc) return;
	const yPerms = collab._doc.getMap('permissions');
	collab._doc.transact(() => {
		yPerms.set(`grant:${clientId}`, JSON.stringify(actions));
	});
}


export function resolvePermission(collab: CollabState, result: boolean) {
	if (collab._permissionTimeout) {
		clearTimeout(collab._permissionTimeout);
		collab._permissionTimeout = null;
	}
	const resolver = collab._permissionResolver;
	collab._permissionResolver = null;

	
	clearPermissionRequest(collab);

	if (resolver) resolver(result);
}


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


export function syncPermissionState(collab: CollabState, yPerms: Y.Map<unknown>) {
	
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

	
	const rawReq = yPerms.get('request') as string | undefined;
	if (!rawReq || rawReq === 'null') {
		collab.permissionRequest = null;
		collab.permissionVotes = new Map();
		
		if (collab._permissionResolver) {
			resolvePermission(collab, false);
		}
		return;
	}

	try {
		const req: PermissionRequest = JSON.parse(rawReq);
		collab.permissionRequest = req;

		
		const newVotes = new Map<number, 'approve' | 'deny'>();
		yPerms.forEach((value: unknown, key: string) => {
			if (key.startsWith('vote:')) {
				const clientId = parseInt(key.slice(5), 10);
				newVotes.set(clientId, value as 'approve' | 'deny');
			}
		});
		collab.permissionVotes = newVotes;

		
		if (req.requesterClientId === collab.localClientId && collab._permissionResolver) {
			checkPermissionResult(collab, req, newVotes);
		}
	} catch {
		collab.permissionRequest = null;
		collab.permissionVotes = new Map();
	}
}


export function checkPermissionResult(collab: CollabState, req: PermissionRequest, votes: Map<number, 'approve' | 'deny'>) {
	
	for (const [, v] of votes) {
		if (v === 'deny') {
			resolvePermission(collab, false);
			return;
		}
	}

	
	const connectedUserIds = new Set(collab.users.map(u => u.id));
	let allResolved = true;
	for (const voterId of req.voterClientIds) {
		if (!connectedUserIds.has(voterId)) {
			
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
