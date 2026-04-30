type ToastType = 'success' | 'info' | 'warning' | 'error';

interface Toast {
	id: string;
	message: string;
	type: ToastType;
	exiting?: boolean;
}

class ToastState {
	toasts = $state<Toast[]>([]);

	push(message: string, type: ToastType = 'info', duration = 3000) {
		const id = crypto.randomUUID();
		this.toasts.push({ id, message, type });
		setTimeout(() => this.dismiss(id), duration);
	}

	dismiss(id: string) {
		const t = this.toasts.find((t) => t.id === id);
		if (!t || t.exiting) return;
		t.exiting = true;
		// Wait for exit animation to complete before removing
		setTimeout(() => {
			this.toasts = this.toasts.filter((t) => t.id !== id);
		}, 200);
	}

	success(msg: string) { this.push(msg, 'success'); }
	info(msg: string) { this.push(msg, 'info'); }
	warning(msg: string) { this.push(msg, 'warning'); }
	error(msg: string) { this.push(msg, 'error'); }
}

export const toast = new ToastState();
