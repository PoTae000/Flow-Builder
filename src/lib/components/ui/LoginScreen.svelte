<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { isGoogleAuthAvailable, renderGoogleButton } from '$lib/utils/google-auth';
	import { theme } from '$lib/stores/theme.svelte';

	let { onskip }: { onskip?: () => void } = $props();

	let googleBtnEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (googleBtnEl && auth.googleReady && !auth.isSignedIn) {
			renderGoogleButton(googleBtnEl);
		}
	});
</script>

<div class="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--ui-bg)] animate-fade-in">
	<div class="flex w-full max-w-sm flex-col items-center gap-8 px-6 animate-scale-in">
		<!-- Logo / Icon -->
		<div class="flex flex-col items-center gap-4">
			<div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--ui-accent)]/10">
				<svg class="h-10 w-10 text-[var(--ui-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<rect x="2" y="3" width="8" height="6" rx="1" />
					<rect x="14" y="3" width="8" height="6" rx="1" />
					<rect x="8" y="15" width="8" height="6" rx="1" />
					<path d="M6 9v2.5a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5V9" />
					<path d="M12 13v2" />
				</svg>
			</div>
			<div class="text-center">
				<h1 class="text-2xl font-semibold text-[var(--ui-text)]">Flow Builder</h1>
				<p class="mt-1 text-sm text-[var(--ui-text-muted)]">สร้าง ER Diagram, Flowchart, Context Diagram</p>
			</div>
		</div>

		<!-- Sign in card -->
		<div class="flex w-full flex-col items-center gap-5 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-6">
			<p class="text-sm font-medium text-[var(--ui-text)]">ลงชื่อเข้าใช้</p>

			{#if isGoogleAuthAvailable()}
				{#if auth.googleReady}
					<div bind:this={googleBtnEl} class="flex items-center justify-center"></div>
				{:else}
					<!-- Loading GIS -->
					<div class="flex items-center gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-bg)] px-5 py-2.5">
						<svg class="h-4 w-4 animate-spin text-[var(--ui-text-muted)]" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
						<span class="text-xs text-[var(--ui-text-muted)]">Loading...</span>
					</div>
				{/if}
			{:else}
				<p class="text-xs text-[var(--ui-text-muted)]">Google Sign-In ไม่พร้อมใช้งาน</p>
			{/if}

			<!-- Divider -->
			<div class="flex w-full items-center gap-3">
				<div class="h-px flex-1 bg-[var(--ui-border)]"></div>
				<span class="text-[10px] uppercase tracking-wider text-[var(--ui-text-muted)]">หรือ</span>
				<div class="h-px flex-1 bg-[var(--ui-border)]"></div>
			</div>

			<!-- Guest -->
			<button
				class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-4 py-2.5 text-sm text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-[0.98]"
				onclick={onskip}
			>
				ใช้งานแบบ Guest
			</button>
		</div>

		<!-- Theme toggle -->
		<button
			class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			onclick={() => theme.toggle()}
		>
			{#if theme.isDark}
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
				Light Mode
			{:else}
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
				Dark Mode
			{/if}
		</button>
	</div>
</div>
