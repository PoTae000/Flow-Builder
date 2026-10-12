<script lang="ts">
	import './layout.css';
	import '$lib/workspace-panels.css';
	import favicon from '$lib/assets/favicon.svg';
	import { auth } from '$lib/stores/auth.svelte';
	$effect(() => {
		if (!auth.isSignedIn) return;
		let pending = false;
		const abort = new AbortController();
		async function ping() {
			if (pending || abort.signal.aborted) return;
			const token = sessionStorage.getItem('er-diagram:id-token');
			if (!token) return;
			pending = true;
			try { await fetch('/api/user/presence', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: abort.signal }); }
			catch { /* Retry on next heartbeat. */ }
			finally { pending = false; }
		}
		void ping();
		const timer = setInterval(() => { void ping(); }, 15_000);
		const resume = () => { if (!document.hidden) void ping(); };
		document.addEventListener('visibilitychange', resume);
		return () => { clearInterval(timer); abort.abort(); document.removeEventListener('visibilitychange', resume); };
	});

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
