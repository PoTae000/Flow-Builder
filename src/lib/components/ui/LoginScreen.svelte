<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { isGoogleAuthAvailable, renderGoogleButton } from '$lib/utils/google-auth';

	let { onskip }: { onskip?: () => void } = $props();

	let googleBtnEl = $state<HTMLDivElement | null>(null);





	let guestEntering = $state(false);
	let guestError = $state('');
	async function handleGuest() {
		if (guestEntering) return;
		guestEntering = true;
		guestError = '';
        try {
            const res = await fetch('/api/guest/ping', { method: 'POST' });
            if (!res.ok) throw new Error(res.status === 429 ? 'เข้าใช้งานถี่เกินไป กรุณารอ 1 นาที' : 'ระบบยังไม่พร้อม กรุณาลองใหม่');
            onskip?.();
        } catch (error) {
            guestError = error instanceof Error ? error.message : 'เชื่อมต่อไม่สำเร็จ';
            guestEntering = false;
        }
	}

	$effect(() => {
		if (googleBtnEl && auth.googleReady && !auth.isSignedIn) {
			renderGoogleButton(googleBtnEl);
		}
	});
</script>



<div class="force-light fixed inset-0 z-[60] flex items-center justify-center bg-[var(--ui-bg)] animate-fade-in">
	<div class="flex w-full max-w-sm flex-col items-center gap-8 px-6 animate-scale-in">

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
				<nav aria-label="เครื่องมือสร้างแผนภาพ" class="mt-3 flex flex-wrap justify-center gap-3 text-sm text-blue-500">
					<a href="/flowchart-online">สร้าง Flowchart</a>
					<a href="/dfd-online">สร้าง DFD</a>
					<a href="/er-diagram-online">สร้าง ER Diagram</a>
				</nav>
				<p class="mt-1 text-sm text-[var(--ui-text-muted)]">สร้างแผนภาพ Flowchart, DFD และ ER Diagram ออนไลน์</p>
			</div>
		</div>


		<div class="flex w-full flex-col items-center gap-5 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-6">
			<p class="text-sm font-medium text-[var(--ui-text)]">ลงชื่อเข้าใช้</p>

			{#if isGoogleAuthAvailable()}
				{#if auth.googleReady}
					<div bind:this={googleBtnEl} class="flex items-center justify-center"></div>
				{:else}

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


			<div class="flex w-full items-center gap-3">
				<div class="h-px flex-1 bg-[var(--ui-border)]"></div>
				<span class="text-[10px] uppercase tracking-wider text-[var(--ui-text-muted)]">หรือ</span>
				<div class="h-px flex-1 bg-[var(--ui-border)]"></div>
			</div>


			<button
				disabled={guestEntering}
				class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-4 py-2.5 text-sm text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
				onclick={handleGuest}
			>
				{guestEntering ? 'กำลังเข้าใช้งาน...' : 'ใช้งานแบบ Guest'}
			</button>
{#if guestError}<p role="alert" class="text-sm text-red-500">{guestError}</p>{/if}
		</div>
	</div>
</div>
