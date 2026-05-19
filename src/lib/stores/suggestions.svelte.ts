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

	async fetchSuggestions(entities: any[], relationships: any[], _retry = 0) {
		if (!this.canFetch || entities.length < 3) return;

		this.loading = true;
		this.dismissed = false;

		try {
			const res = await fetch('/api/suggest-improvement', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entities, relationships })
			});

			if (res.status === 429 && _retry < 2) {
				// Exponential backoff: 5s, 15s
				const delay = _retry === 0 ? 5000 : 15000;
				this.loading = false;
				await new Promise((r) => setTimeout(r, delay));
				return this.fetchSuggestions(entities, relationships, _retry + 1);
			}

			if (!res.ok) {
				this.suggestions = [];
				return;
			}

			const data: any = await res.json();
			if (data.suggestions && Array.isArray(data.suggestions)) {
				this.suggestions = data.suggestions.slice(0, 3);
			} else {
				// Try to parse if response is wrapped
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
	}
}

export const suggestions = new SuggestionState();
