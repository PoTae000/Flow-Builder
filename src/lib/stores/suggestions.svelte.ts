import type { DiagramType } from '$lib/types/diagram';
import { aiFetch } from '$lib/utils/ai-fetch';

export interface Suggestion {
	text: string;
	detail: string;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

class SuggestionState {
	suggestions = $state<Suggestion[]>([]);
	loading = $state(false);
	dismissed = $state(false);
	lastFetchedAt = $state(0);

	get canFetch(): boolean {
		return !this.loading && Date.now() - this.lastFetchedAt >= COOLDOWN_MS;
	}

	async fetchSuggestions(payload: Record<string, any>, diagramType: DiagramType = 'er', _retry = 0): Promise<void> {
		if (!this.canFetch) return;

		this.loading = true;
		this.dismissed = false;

		try {
			const res = await aiFetch('/api/suggest-improvement', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...payload, diagramType })
			});

			if (res.status === 429 && _retry < 2) {
				const delay = _retry === 0 ? 5000 : 15000;
				this.loading = false;
				await new Promise((r) => setTimeout(r, delay));
				return this.fetchSuggestions(payload, diagramType, _retry + 1);
			}

			if (!res.ok) {
				this.suggestions = [];
				this.lastFetchedAt = Date.now();
				return;
			}

			const data: any = await res.json();
			if (data.suggestions && Array.isArray(data.suggestions)) {
				this.suggestions = data.suggestions.slice(0, 3);
			} else {
				try {
					const parsed = typeof data === 'string' ? JSON.parse(data) : data;
					if (parsed.suggestions) {
						this.suggestions = parsed.suggestions.slice(0, 3);
					}
				} catch {
					this.suggestions = [];
				}
			}
			this.lastFetchedAt = Date.now();
		} catch {
			this.suggestions = [];
			this.lastFetchedAt = Date.now();
		} finally {
			this.loading = false;
		}
	}

	/** Suppress auto-fetch after an AI action (fix/analyze) to avoid 429 */
	suppressAutoFetch() {
		this.lastFetchedAt = Date.now();
	}

	dismiss() {
		this.dismissed = true;
		this.suggestions = [];
	}

	reset() {
		this.suggestions = [];
		this.dismissed = false;
		this.loading = false;
		this.lastFetchedAt = 0;
	}
}

export const suggestions = new SuggestionState();
