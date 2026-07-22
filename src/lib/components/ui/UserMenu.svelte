<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { triggerSignIn, triggerSignOut, isGoogleAuthAvailable, renderGoogleButton } from '$lib/utils/google-auth';

	let showDropdown = $state(false);
	let portalLoading = $state(false);

	// Sync dropdown state to shared UI store so toolbar can hide
	$effect(() => {
		ui.userMenuOpen = showDropdown;
	});
	let googleBtnContainer = $state<HTMLDivElement | null>(null);
	let imageLoadFailed = $state(false);
	let lastPictureUrl = $state('');

	function handleSignOut() {
		showDropdown = false;
		triggerSignOut();
	}

	function handleUpgrade() {
		showDropdown = false;
		ui.showUpgradeModal = true;
	}

	async function handleManageSubscription() {
		portalLoading = true;
		try {
			const token = sessionStorage.getItem('er-diagram:id-token');
			if (!token) return;
			const res = await fetch('/api/stripe/portal', {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			if (res.ok) {
				const data = await res.json();
				if (data.url) window.location.href = data.url;
			}
		} catch {
			// ignore
		} finally {
			portalLoading = false;
		}
	}

	// Reset imageLoadFailed only when picture URL actually changes
	$effect(() => {
		const pic = auth.user?.picture ?? '';
		if (pic !== lastPictureUrl) {
			lastPictureUrl = pic;
			imageLoadFailed = false;
		}
	});

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
			class="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[var(--ui-border)] hover:ring-[var(--ui-accent)] transition-all aspect-square"
			aria-label="User menu"
			onclick={() => (showDropdown = !showDropdown)}
		>
			<!-- Fallback: always rendered as base layer -->
			<div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
				<svg class="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z" /></svg>
			</div>
			<!-- Profile image: overlays the fallback when loaded successfully -->
			{#if auth.user?.picture}
				<img
					src={auth.user.picture}
					alt=""
					class="absolute inset-0 h-full w-full object-cover"
					class:invisible={imageLoadFailed}
					referrerpolicy="no-referrer"
					onerror={() => { imageLoadFailed = true; }}
					onload={(e) => {
						const img = e.currentTarget as HTMLImageElement;
						if (img.naturalWidth === 0) { imageLoadFailed = true; }
					}}
				/>
			{/if}
		</button>

		{#if showDropdown}
			<!-- Backdrop -->
			<button
				type="button"
				class="fixed inset-0 z-[90] cursor-default border-none bg-black/10"
				aria-label="Close menu"
				onclick={() => (showDropdown = false)}
			></button>

			<div class="absolute right-0 top-full mt-3 z-[100] w-48 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] py-1 shadow-lg animate-slide-up">
				<div class="border-b border-[var(--ui-border-light)] px-3 py-2">
					<p class="truncate text-xs font-normal text-[var(--ui-text)]">{auth.user?.name}</p>
					<p class="truncate text-[10px] text-[var(--ui-text-muted)]">{auth.user?.email}</p>
					<div class="mt-1.5">
						{#if auth.isAdmin}
							<span class="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
								<svg class="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
								Admin
							</span>
						{:else if auth.plan === 'advanced'}
							<span class="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
								<svg class="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
								Advanced
							</span>
						{:else}
							<span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
								Basic
							</span>
						{/if}
					</div>
				</div>
				{#if auth.isAdmin}
				<button
					class="w-full px-3 py-1.5 text-left text-xs text-amber-600 dark:text-amber-400 font-medium hover:bg-[var(--ui-hover)]"
					onclick={() => { showDropdown = false; ui.showAdminPanel = true; }}
				>
					Admin Dashboard
				</button>
			{/if}
			{#if auth.plan === 'advanced' && !auth.isAdmin}
					<button
						class="w-full px-3 py-1.5 text-left text-xs text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)] disabled:opacity-50"
						onclick={handleManageSubscription}
						disabled={portalLoading}
					>
						{portalLoading ? 'Loading...' : 'Manage Subscription'}
					</button>
				{:else if auth.plan !== 'advanced' && !auth.isAdmin}
					<button
						class="w-full px-3 py-1.5 text-left text-xs text-purple-600 dark:text-purple-400 font-medium hover:bg-[var(--ui-hover)]"
						onclick={handleUpgrade}
					>
						Upgrade to Advanced
					</button>
				{/if}
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
