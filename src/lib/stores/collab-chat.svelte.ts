import type { CollabState, ChatMessage } from './collab.svelte';
import { snap } from './collab-utils';

/**
 * Push a chat message to the shared Y.Array.
 */
export function pushChatMessage(collab: CollabState, msg: ChatMessage) {
	if (!collab._doc) return;
	collab._suppressChatSync = true;
	try {
		collab._doc.transact(() => {
			collab._doc!.getArray('chat').push([snap(msg)]);
		});
	} finally {
		collab._suppressChatSync = false;
	}
	collab.chatMessages = collab._doc.getArray('chat').toArray() as ChatMessage[];
}

/**
 * Clear all shared chat messages (host only, keeps backup for undo).
 */
export function clearChat(collab: CollabState) {
	if (!collab._doc || (collab.connected && !collab.isHost)) return;
	const yChat = collab._doc.getArray('chat');
	collab._chatBackup = snap(collab.chatMessages);
	collab._suppressChatSync = true;
	try {
		yChat.delete(0, yChat.length);
	} finally {
		collab._suppressChatSync = false;
	}
	collab.chatMessages = [];
}

/**
 * Restore chat messages from backup.
 */
export function restoreChat(collab: CollabState) {
	if (!collab._doc || collab._chatBackup.length === 0) return;
	const yChat = collab._doc.getArray('chat');
	collab._suppressChatSync = true;
	try {
		yChat.push(collab._chatBackup);
	} finally {
		collab._suppressChatSync = false;
	}
	collab.chatMessages = yChat.toArray() as ChatMessage[];
	collab._chatBackup = [];
}
