import { getQueueSize } from '$lib/stores/offline-queue';

/** Minimal UI state shared across components */
class UIState {
	userMenuOpen = $state(false);
	isOnline = $state(true);
	offlineQueueCount = $state(0);
	showUpgradeModal = $state(false);
	showAdminPanel = $state(false);

	constructor() {
		if (typeof window !== 'undefined') {
			this.isOnline = navigator.onLine;
			window.addEventListener('online', () => {
				this.isOnline = true;
			});
			window.addEventListener('offline', () => {
				this.isOnline = false;
				this.refreshQueueCount();
			});
		}
	}

	async refreshQueueCount() {
		try {
			this.offlineQueueCount = await getQueueSize();
		} catch {
			// IndexedDB may not be available
		}
	}
}

export const ui = new UIState();
