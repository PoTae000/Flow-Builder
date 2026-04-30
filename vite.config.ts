import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { signalingServer } from './vite-plugin-signaling';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), signalingServer()],
	server: {
		allowedHosts: process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',') : []
	},
	build: {
		sourcemap: false
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
		alias: {
			'$lib': fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	}
});
