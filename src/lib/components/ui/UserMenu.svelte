<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { triggerSignIn, triggerSignOut, isGoogleAuthAvailable, renderGoogleButton } from '$lib/utils/google-auth';

	let showDropdown = $state(false);
	let googleBtnContainer = $state<HTMLDivElement | null>(null);

	function handleSignOut() {
		showDropdown = false;
		triggerSignOut();
	}

	// Render the official Google button once GIS script is loaded
	$effect(() => {
		if (googleBtnContainer && auth.googleReady && !auth.isSignedIn) {
			renderGoogleButton(googleBtnContainer);
		}
	});
</script>

{#if auth.isSignedIn}
	<div class="relative">
		<button
			class="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full ring-1 ring-[var(--ui-border)]"
			aria-label="User menu"
			onclick={() => (showDropdown = !showDropdown)}
		>
			{#if auth.user?.picture}
				<img src={auth.user.picture} alt="" class="h-full w-full object-cover" referrerpolicy="no-referrer" />
			{:else}
				<svg class="h-4 w-4 text-[var(--ui-text-muted)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z" /></svg>
			{/if}
		</button>

		{#if showDropdown}
			<!-- Backdrop -->
			<button
				type="button"
				class="fixed inset-0 z-40 cursor-default border-none bg-transparent"
				aria-label="Close menu"
				onclick={() => (showDropdown = false)}
			></button>

			<div class="absolute right-0 top-8 z-50 w-48 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] py-1 shadow-lg animate-slide-up">
				<div class="border-b border-[var(--ui-border-light)] px-3 py-2">
					<p class="truncate text-xs font-normal text-[var(--ui-text)]">{auth.user?.name}</p>
					<p class="truncate text-[10px] text-[var(--ui-text-muted)]">{auth.user?.email}</p>
				</div>
				<button
					class="w-full px-3 py-1.5 text-left text-xs text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)]"
					onclick={handleSignOut}
				>
					Sign out
				</button>
			</div>
		{/if}
	</div>
{:else if isGoogleAuthAvailable()}
	{#if auth.googleReady}
		<!-- Official Google button rendered by GIS -->
		<div bind:this={googleBtnContainer} class="flex items-center"></div>
	{:else}
		<!-- Fallback button while GIS script is loading -->
		<button
			class="flex items-center gap-1.5 rounded-full border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-1 text-xs font-normal text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)]"
			onclick={triggerSignIn}
			disabled
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 24 24">
				<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
				<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
				<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
				<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
			</svg>
			Sign in
		</button>
	{/if}
{/if}
