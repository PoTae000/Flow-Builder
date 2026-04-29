export type DialogOptions = {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: 'danger' | 'info';
};

type DialogState = DialogOptions & {
	resolve: (confirmed: boolean) => void;
};

class DialogStore {
	current = $state<DialogState | null>(null);

	confirm(options: DialogOptions): Promise<boolean> {
		return new Promise((resolve) => {
			this.current = { ...options, resolve };
		});
	}

	alert(title: string, message: string): Promise<boolean> {
		return this.confirm({
			title,
			message,
			confirmText: 'ตกลง',
			cancelText: '',
			variant: 'info'
		});
	}

	close(result: boolean) {
		this.current?.resolve(result);
		this.current = null;
	}
}

export const dialog = new DialogStore();
