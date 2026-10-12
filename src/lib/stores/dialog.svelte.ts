export type DialogOptions = {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	secondaryText?: string;
	variant?: 'danger' | 'info';
};

type DialogState = DialogOptions & {
	resolve: (confirmed: boolean | 'secondary') => void;
};

class DialogStore {
	current = $state<DialogState | null>(null);

	confirm(options: DialogOptions): Promise<boolean> {
		return new Promise((resolve) => {
			this.current = { ...options, resolve: result => resolve(result === true) };
		});
	}

	choose(options: DialogOptions): Promise<'save' | 'discard' | 'cancel'> {
		return new Promise(resolve => {
			this.current = { ...options, resolve: result => resolve(result === true ? 'save' : result === 'secondary' ? 'discard' : 'cancel') };
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

	close(result: boolean | 'secondary') {
		this.current?.resolve(result);
		this.current = null;
	}
}

export const dialog = new DialogStore();
