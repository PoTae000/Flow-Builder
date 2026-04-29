type ToastType = 'success' | 'info' | 'warning' | 'error';

interface Toast {
	id: string;
	message: string;
	type: ToastType;
}

class ToastState {
	toasts = $state<Toast[]>([]);

	push(message: string, type: ToastType = 'info', duration = 3000) {
		const id = crypto.randomUUID();
		this.toasts.push({ id, message, type });
		setTimeout(() => this.dismiss(id), duration);
	}

	dismiss(id: string) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	success(msg: string) { this.push(msg, 'success'); }
	info(msg: string) { this.push(msg, 'info'); }
	warning(msg: string) { this.push(msg, 'warning'); }
	error(msg: string) { this.push(msg, 'error'); }
}

export const toast = new ToastState();
