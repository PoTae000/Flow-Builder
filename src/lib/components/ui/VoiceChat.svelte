<script lang="ts">
	import { voiceChat } from '$lib/stores/voice-chat.svelte';
	import { collab } from '$lib/stores/collab.svelte';

	const enabled = $derived(voiceChat.enabled);
	const muted = $derived(voiceChat.muted);
	const deafened = $derived(voiceChat.deafened);
	const error = $derived(voiceChat.error);
	const peers = $derived(Array.from(voiceChat.peers.values()));

	async function toggleVoice() {
		await voiceChat.toggleVoice();
	}

	function toggleMute() {
		voiceChat.toggleMute();
	}

	function toggleDeafen() {
		voiceChat.toggleDeafen();
	}

	// Map peer clientId to user info from collab
	function getPeerName(clientId: number): string {
		const user = collab.users.find(u => u.id === clientId);
		return user?.name || 'Unknown';
	}

	function getPeerColor(clientId: number): string {
		const user = collab.users.find(u => u.id === clientId);
		return user?.color || '#6b7280';
	}
</script>

<div class="border-t border-[var(--ui-border)] p-3">
	<div class="mb-2 flex items-center justify-between">
		<span class="text-xs font-medium text-[var(--ui-text)]">Voice Chat</span>
		{#if enabled}
			<div class="flex items-center gap-1">
				<!-- Mute button -->
				<button
					class="flex h-6 w-6 items-center justify-center rounded {muted
						? 'bg-red-600 text-white hover:bg-red-700'
						: 'bg-green-600 text-white hover:bg-green-700'}"
					aria-label={muted ? 'Unmute' : 'Mute'}
					title={muted ? 'Unmute (Space)' : 'Mute (Space)'}
					onclick={toggleMute}
				>
					{#if muted}
						<!-- Mic off -->
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
						</svg>
					{:else}
						<!-- Mic on -->
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
						</svg>
					{/if}
				</button>

				<!-- Deafen button -->
				<button
					class="flex h-6 w-6 items-center justify-center rounded {deafened
						? 'bg-red-600 text-white hover:bg-red-700'
						: 'bg-gray-600 text-white hover:bg-gray-700'}"
					aria-label={deafened ? 'Undeafen' : 'Deafen'}
					title={deafened ? 'Undeafen' : 'Deafen'}
					onclick={toggleDeafen}
				>
					{#if deafened}
						<!-- Headphones off -->
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="1" y1="1" x2="23" y2="23"/><path d="M3 14v3a2 2 0 0 0 2 2h2m7-5v3a2 2 0 0 1-2 2h-1"/><path d="M21 14v3m-9-12a9 9 0 0 1 9 9v1"/>
						</svg>
					{:else}
						<!-- Headphones on -->
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
						</svg>
					{/if}
				</button>

				<!-- Disconnect button -->
				<button
					class="flex h-6 w-6 items-center justify-center rounded bg-gray-600 text-white hover:bg-gray-700"
					aria-label="Leave voice"
					title="Leave voice"
					onclick={toggleVoice}
				>
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 6L6 18M6 6l12 12"/>
					</svg>
				</button>
			</div>
		{:else}
			<button
				class="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
				onclick={toggleVoice}
			>
				เข้าร่วม Voice
			</button>
		{/if}
	</div>

	{#if error}
		<div class="mt-2 rounded bg-red-100 p-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
			{error}
		</div>
	{/if}

	{#if enabled}
		<div class="mt-2 space-y-1">
			<div class="text-[10px] text-[var(--ui-text-muted)]">ในห้อง Voice ({peers.length + 1})</div>

			<!-- My status -->
			<div class="flex items-center gap-2 rounded bg-[var(--ui-hover)] px-2 py-1">
				<div class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
					คุณ
				</div>
				<span class="flex-1 text-xs text-[var(--ui-text)]">คุณ {muted ? '(ปิดเสียง)' : ''}</span>
				{#if !muted}
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
				{/if}
			</div>

			<!-- Peers -->
			{#each peers as peer}
				<div class="flex items-center gap-2 px-2 py-1">
					<div
						class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
						style="background-color: {getPeerColor(peer.clientId)};"
					>
						{getPeerName(peer.clientId).charAt(0).toUpperCase()}
					</div>
					<span class="flex-1 text-xs text-[var(--ui-text)]">{getPeerName(peer.clientId)}</span>
					{#if peer.speaking}
						<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Info note -->
	{#if enabled}
		<div class="mt-2 rounded bg-blue-100 p-2 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
			<strong>Note:</strong> Voice chat ใช้ WebRTC สำหรับการสื่อสารแบบ P2P คุณภาพเสียงขึ้นอยู่กับการเชื่อมต่ออินเทอร์เน็ตของคุณ
		</div>
	{/if}
</div>
