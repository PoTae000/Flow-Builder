<script lang="ts">
	import { collab } from '$lib/stores/collab.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import type { PermissionAction } from '$lib/stores/collab.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let joinId = $state('');
	let copied = $state(false);
	/** Which user's grant dropdown is open (clientId), -1 = none */
	let grantMenuFor = $state(-1);

	const GRANT_ACTIONS: { value: PermissionAction; label: string }[] = [
		{ value: 'import', label: 'นำเข้า' },
		{ value: 'ai-analysis', label: 'วิเคราะห์/แก้ AI' },
		{ value: 'translate', label: 'แปลภาษา' },
		{ value: 'auto-layout', label: 'จัดวาง' },
		{ value: 'presentation', label: 'นำเสนอ' },
		{ value: 'change-notation', label: 'เปลี่ยน Notation' },
		{ value: 'change-font', label: 'เปลี่ยนฟอนต์' },
		{ value: 'domain-starter', label: 'Domain Starter' },
		{ value: 'templates', label: 'Templates' },
	];

	function handleCreate() {
		if (auth.user) {
			collab.userName = auth.user.name;
			collab.userPicture = auth.user.picture;
		}
		collab.saveUserName();
		collab.createRoom();
	}

	function handleJoin() {
		if (!joinId.trim()) return;
		if (auth.user) {
			collab.userName = auth.user.name;
			collab.userPicture = auth.user.picture;
		}
		collab.saveUserName();
		collab.joinRoom(joinId.trim().toLowerCase());
	}

	function handleLeave() {
		if (collab.isHost) {
			collab.dismissRoom();
		} else {
			collab.leaveRoom();
		}
	}

	async function copyLink() {
		const text = collab.shareUrl;
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Fallback for browsers that block clipboard API
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.focus();
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		}
		copied = true;
		setTimeout(() => copied = false, 2000);
	}

	function handleKick(userId: number) {
		collab.kickUser(userId);
	}

	function toggleGrant(clientId: number, action: PermissionAction) {
		if (collab.hasGrant(clientId, action)) {
			collab.revokePermission(clientId, action);
		} else {
			collab.grantPermission(clientId, action);
		}
	}

	function toggleGrantMenu(clientId: number) {
		grantMenuFor = grantMenuFor === clientId ? -1 : clientId;
	}

	function grantCountFor(clientId: number): number {
		return collab.permissionGrants.get(clientId)?.size ?? 0;
	}

	// Swipe-to-close on mobile
	let swipeStartY = $state(0);
	let swipeDeltaY = $state(0);
	let swiping = $state(false);

	function handleSwipeStart(e: TouchEvent) {
		swipeStartY = e.touches[0].clientY;
		swipeDeltaY = 0;
		swiping = true;
	}

	function handleSwipeMove(e: TouchEvent) {
		if (!swiping) return;
		const dy = e.touches[0].clientY - swipeStartY;
		swipeDeltaY = Math.max(0, dy);
	}

	function handleSwipeEnd() {
		if (swipeDeltaY > 80) {
			onclose();
		}
		swipeDeltaY = 0;
		swiping = false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="fixed inset-0 z-40" onclick={() => { grantMenuFor = -1; onclose(); }}></div>
<div
	class="fixed z-50 max-h-[80vh] overflow-y-auto border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-xl inset-x-0 bottom-0 w-full rounded-t-2xl md:inset-x-auto md:bottom-auto md:top-26 md:right-3 md:w-80 md:rounded-lg"
	style="transform: translateY({swipeDeltaY}px); opacity: {Math.max(0.3, 1 - swipeDeltaY / 200)}; transition: {swiping ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out'};"
>
	<!-- Drag handle (mobile only) -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex justify-center py-2 cursor-grab md:hidden"
		ontouchstart={handleSwipeStart}
		ontouchmove={handleSwipeMove}
		ontouchend={handleSwipeEnd}
	>
		<div class="h-1 w-10 rounded-full bg-[var(--ui-border)]"></div>
	</div>
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
			<span class="text-sm font-medium text-[var(--ui-text)]">ห้องทำงานร่วม</span>
			{#if collab.connected}
				<span class="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
					<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
					เชื่อมต่อแล้ว
				</span>
			{/if}
		</div>
		<button
			class="rounded p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			onclick={onclose}
			aria-label="Close collaboration panel"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<div class="p-4 space-y-4">
		{#if !collab.connected}
			<!-- User profile preview -->
			{#if auth.user}
				<div class="flex items-center gap-3 rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3">
					<img
						src={auth.user.picture}
						alt={auth.user.name}
						class="h-10 w-10 rounded-full"
						referrerpolicy="no-referrer"
					/>
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-medium text-[var(--ui-text)]">{auth.user.name}</div>
						<div class="truncate text-xs text-[var(--ui-text-muted)]">{auth.user.email}</div>
					</div>
				</div>
			{:else}
				<div>
					<span class="mb-1 block text-xs font-medium text-[var(--ui-text-secondary)]">ชื่อของคุณ</span>
					<input
						type="text"
						bind:value={collab.userName}
						placeholder="ใส่ชื่อ..."
						class="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-1.5 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:border-[var(--ui-accent)] focus:outline-none"
					/>
				</div>
			{/if}

			<!-- Create room -->
			<button
				class="w-full rounded bg-[var(--ui-accent)] px-3 py-2 text-sm font-medium text-[var(--ui-accent-text)] transition hover:opacity-90"
				onclick={handleCreate}
			>
				สร้างห้อง
			</button>

			<!-- Divider -->
			<div class="flex items-center gap-3">
				<div class="h-px flex-1 bg-[var(--ui-border)]"></div>
				<span class="text-xs text-[var(--ui-text-muted)]">หรือ</span>
				<div class="h-px flex-1 bg-[var(--ui-border)]"></div>
			</div>

			<!-- Join room -->
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={joinId}
					placeholder="รหัสห้อง..."
					maxlength="8"
					class="flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-1.5 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:border-[var(--ui-accent)] focus:outline-none"
					onkeydown={(e) => e.key === 'Enter' && handleJoin()}
				/>
				<button
					class="rounded bg-[var(--ui-accent)] px-4 py-1.5 text-sm font-medium text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-50"
					onclick={handleJoin}
					disabled={!joinId.trim()}
				>
					เข้าร่วม
				</button>
			</div>
		{:else}
			<!-- Room info -->
			<div class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3">
				<div class="flex items-center justify-between">
					<div>
						<span class="text-xs text-[var(--ui-text-muted)]">รหัสห้อง</span>
						<div class="text-lg font-mono font-bold tracking-wider text-[var(--ui-text)] select-all">{collab.roomId}</div>
					</div>
					<button
						class="rounded px-3 py-1.5 text-xs transition {copied ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-[var(--ui-hover)] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text)]'}"
						onclick={copyLink}
					>
						{copied ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}
					</button>
				</div>
				{#if collab.isHost}
					<span class="mt-1 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Host</span>
				{/if}
			</div>

			<!-- Sync status -->
			{#if !collab.synced && collab.users.length <= 1}
				<div class="flex items-center gap-2 rounded bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
					<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
					กำลังรอผู้ร่วมงาน...
				</div>
			{/if}

			<!-- Users list -->
			<div>
				<span class="mb-2 block text-xs font-medium text-[var(--ui-text-secondary)]">
					ออนไลน์ ({collab.users.length})
				</span>
				<div class="space-y-1">
					{#each collab.users as user (user.id)}
						<div class="group relative">
							<div class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--ui-hover)]">
								{#if user.picture}
									<img
										src={user.picture}
										alt={user.name}
										class="h-6 w-6 rounded-full"
										referrerpolicy="no-referrer"
									/>
								{:else}
									<span
										class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
										style="background-color: {user.color}"
									>{user.name.charAt(0).toUpperCase()}</span>
								{/if}
								<span class="flex-1 truncate text-sm text-[var(--ui-text)]">{user.name}</span>

								<!-- Grant count badge -->
								{#if grantCountFor(user.id) > 0}
									<span class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
										{grantCountFor(user.id)} สิทธิ์
									</span>
								{/if}

								<!-- Host actions -->
								{#if collab.isHost}
									<!-- Permission grant button (for self and others) -->
									<button
										class="hidden rounded p-1 text-[var(--ui-text-muted)] hover:bg-blue-100 hover:text-blue-600 group-hover:block dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
										onclick={(e) => { e.stopPropagation(); toggleGrantMenu(user.id); }}
										title="จัดการสิทธิ์"
										aria-label="จัดการสิทธิ์ {user.name}"
									>
										<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
									</button>
									<!-- Kick button (not for self) -->
									{#if user.id !== collab.localClientId}
										<button
											class="hidden rounded p-1 text-[var(--ui-text-muted)] hover:bg-red-100 hover:text-red-600 group-hover:block dark:hover:bg-red-900/30 dark:hover:text-red-400"
											onclick={() => handleKick(user.id)}
											title="Kick user"
											aria-label="Kick {user.name}"
										>
											<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
										</button>
									{/if}
								{/if}
							</div>

							<!-- Grant dropdown -->
							{#if grantMenuFor === user.id}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="mt-1 ml-8 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2 shadow-lg"
									onclick={(e) => e.stopPropagation()}
									onkeydown={() => {}}
								>
									<div class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--ui-text-muted)]">
										ทำได้โดยไม่ต้องขอ
									</div>
									{#each GRANT_ACTIONS as ga}
										<label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-[var(--ui-text)] hover:bg-[var(--ui-hover)]">
											<input
												type="checkbox"
												checked={collab.hasGrant(user.id, ga.value)}
												onchange={() => toggleGrant(user.id, ga.value)}
												class="h-3.5 w-3.5 rounded border-[var(--ui-border)] accent-blue-500"
											/>
											{ga.label}
										</label>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Leave button -->
			<button
				class="w-full rounded border border-red-300 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
				onclick={handleLeave}
			>
				ออกจากห้อง
			</button>
		{/if}
	</div>
</div>
