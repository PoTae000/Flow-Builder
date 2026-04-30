import type { UserProfile } from '$lib/types/session';
import { safeSave } from '$lib/utils/storage';

const STORAGE_KEY = 'er-diagram:auth-user';

class AuthState {
	user = $state<UserProfile | null>(null);
	isSignedIn = $derived(this.user !== null);
	googleReady = $state(false);

	get storagePrefix(): string {
		if (this.user) {
			return `er-diagram:user:${this.user.sub}`;
		}
		return 'er-diagram:guest';
	}

	constructor() {
		// Restore user from localStorage on init
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				this.user = JSON.parse(stored);
			}
		} catch {
			// ignore
		}
	}

	signIn(profile: UserProfile) {
		this.user = profile;
		// Omit email from localStorage persist — only store sub, name, picture
		const { sub, name, picture } = profile;
		safeSave(STORAGE_KEY, JSON.stringify({ sub, name, picture }));
	}

	signOut() {
		this.user = null;
		localStorage.removeItem(STORAGE_KEY);
	}
}

export const auth = new AuthState();
