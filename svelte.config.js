import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		// Google Sign-In redirect mode POSTs the credential to /login/callback from
		// accounts.google.com (cross-origin). SvelteKit's built-in CSRF check would
		// reject that form submit, so allow it here. The callback does its own
		// double-submit CSRF check (g_csrf_token cookie vs body) + verifies the JWT
		// signature server-side, so disabling the generic check is safe — and there
		// are no other form actions in this app that rely on it.
		csrf: { checkOrigin: false }
	}
};

export default config;
