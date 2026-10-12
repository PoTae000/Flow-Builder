import type { ChatMessage } from '$lib/stores/collab.svelte';
import type { AgentAction } from '$lib/types/agent';


export interface ChatActionData {
	actions: AgentAction[];
		diagramType?: string;
		parentId?: string;
		diagramId?: string | null;
	appliedBy?: string;
}


export interface LocalMessage extends ChatMessage {
	action?: ChatActionData;
}

const STORAGE_KEY = 'flow-builder-local-chat';
const MAX_MESSAGES = 200;

function readInitial(): LocalMessage[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
	} catch {
		return [];
	}
}


class LocalChatState {
	messages = $state<LocalMessage[]>(readInitial());
	private _backup: LocalMessage[] = [];

	private persist() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
		} catch {
			// Quota exceeded or storage disabled — chat still works in-memory.
		}
	}

	push(msg: LocalMessage) {
		this.messages = [...this.messages, msg];
		if (this.messages.length > MAX_MESSAGES) {
			this.messages = this.messages.slice(-MAX_MESSAGES);
		}
		this.persist();
	}

	clear() {
		this._backup = [...this.messages];
		this.messages = [];
		this.persist();
	}

	restore() {
		if (this._backup.length) {
			this.messages = this._backup;
			this._backup = [];
			this.persist();
		}
	}

	
	markActionApplied(index: number, appliedBy: string) {
		this.messages = this.messages.map((m, i) =>
			i === index && m.action ? { ...m, action: { ...m.action, appliedBy } } : m
		);
		this.persist();
	}
}

export const localChat = new LocalChatState();
