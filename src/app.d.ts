// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
	}

	// Google Identity Services
	namespace google.accounts.id {
		interface CredentialResponse {
			credential: string;
			select_by: string;
		}

		function initialize(config: {
			client_id: string;
			callback: (response: CredentialResponse) => void;
			auto_select?: boolean;
			cancel_on_tap_outside?: boolean;
			use_fedcm_for_prompt?: boolean;
		}): void;

		function prompt(
			momentListener?: (notification: {
				isNotDisplayed: () => boolean;
				isSkippedMoment: () => boolean;
				isDismissedMoment: () => boolean;
				getNotDisplayedReason: () => string;
				getSkippedReason: () => string;
				getDismissedReason: () => string;
			}) => void
		): void;

		function renderButton(
			parent: HTMLElement,
			options: {
				type?: 'standard' | 'icon';
				theme?: 'outline' | 'filled_blue' | 'filled_black';
				size?: 'large' | 'medium' | 'small';
				text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
				shape?: 'rectangular' | 'pill' | 'circle' | 'square';
				width?: number | string;
				logo_alignment?: 'left' | 'center';
			}
		): void;

		function revoke(email: string, callback: () => void): void;

		function disableAutoSelect(): void;
	}
}

export {};
