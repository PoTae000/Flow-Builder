import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { signalingServer } from './vite-plugin-signaling';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), signalingServer()],
	server: {
		allowedHosts: ['.trycloudflare.com']
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
		alias: {
			'$lib': fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	}
});
