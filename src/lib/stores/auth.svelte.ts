import type { UserProfile, PlanType } from '$lib/types/session';
import { safeSave } from '$lib/utils/storage';

const STORAGE_KEY = 'er-diagram:auth-user';

class AuthState {
	user = $state<UserProfile | null>(null);
	isSignedIn = $derived(this.user !== null);
	googleReady = $state(false);
	private expiryTimer: ReturnType<typeof setTimeout> | null = null;

	get plan(): PlanType {
		return this.user?.plan ?? 'basic';
	}

	get isAdmin(): boolean {
		return this.user?.isAdmin ?? false;
	}

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
				const parsed = JSON.parse(stored);
				// Ensure plan field exists (backward compat)
				if (!parsed.plan) parsed.plan = 'basic';
				this.user = parsed;
				this.scheduleExpiryCheck();
			}
		} catch {
			// ignore
		}
	}

	signIn(profile: UserProfile) {
		this.user = profile;
		this.saveToStorage();
		this.scheduleExpiryCheck();
	}

	updatePlan(plan: PlanType, isAdmin?: boolean, planExpiresAt?: string | null) {
		if (this.user) {
			this.user = {
				...this.user,
				plan,
				isAdmin: isAdmin ?? this.user.isAdmin,
				planExpiresAt: planExpiresAt !== undefined ? planExpiresAt : this.user.planExpiresAt
			};
			this.saveToStorage();
			this.scheduleExpiryCheck();
		}
	}

	signOut() {
		this.clearExpiryTimer();
		this.user = null;
		localStorage.removeItem(STORAGE_KEY);
	}

	private saveToStorage() {
		if (!this.user) return;
		const { sub, name, email, picture, plan, isAdmin, planExpiresAt } = this.user;
		safeSave(STORAGE_KEY, JSON.stringify({ sub, name, email, picture, plan, isAdmin, planExpiresAt }));
	}

	private clearExpiryTimer() {
		if (this.expiryTimer) {
			clearTimeout(this.expiryTimer);
			this.expiryTimer = null;
		}
	}

	private scheduleExpiryCheck() {
		this.clearExpiryTimer();
		if (!this.user || this.user.plan !== 'advanced' || !this.user.planExpiresAt) return;

		const ms = new Date(this.user.planExpiresAt).getTime() - Date.now();
		if (ms <= 0) {
			// Already expired — downgrade now
			this.updatePlan('basic', undefined, null);
			return;
		}
		const MAX_DELAY = 24 * 60 * 60 * 1000;
		if (ms > MAX_DELAY) {
			// Longer than setTimeout can safely hold — sleep 24h then re-check,
			// don't downgrade yet (plan isn't actually expired).
			this.expiryTimer = setTimeout(() => this.scheduleExpiryCheck(), MAX_DELAY);
			return;
		}
		// Within range — schedule the real downgrade at expiry.
		this.expiryTimer = setTimeout(() => {
			this.updatePlan('basic', undefined, null);
		}, ms);
	}
}

export const auth = new AuthState();
