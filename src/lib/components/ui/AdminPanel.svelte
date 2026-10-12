<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';

	interface User {
		sub: string;
		email: string | null;
		name: string | null;
		plan: string;
		plan_expires_at: string | null;
		stripe_customer_id: string | null;
		created_at: string;
		last_seen: string | null;
		online: boolean;
	}

	interface Guest {
		guest_id: string;
		first_seen: string;
		last_seen: string;
		online: boolean;
	}

	let tab = $state<'users' | 'guests'>('users');
	let guestFilter = $state<'online' | 'offline'>('online');
	let userFilter = $state<'online' | 'offline'>('online');
	let users = $state<User[]>([]);
	let onlineUsers = $derived(users.filter((u) => u.online));
	let offlineUsers = $derived(users.filter((u) => !u.online));
	let shownUsers = $derived(userFilter === 'online' ? onlineUsers : offlineUsers);
	let guests = $state<{ total: number; active: number; onlineUsers: number }>({ total: 0, active: 0, onlineUsers: 0 });
	let totalOnline = $derived(guests.onlineUsers + guests.active);
	let guestList = $state<Guest[]>([]);
	let onlineGuests = $derived(guestList.filter((g) => g.online));
	let offlineGuests = $derived(guestList.filter((g) => !g.online));
	let shownGuests = $derived(guestFilter === 'online' ? onlineGuests : offlineGuests);
	let guestsLoading = $state(false);
	let loading = $state(false);
	let errorMsg = $state('');
	let actionLoading = $state<string | null>(null);
	let expandedRow = $state<string | null>(null);
	let expiresDays = $state(30);
	let live = $state(true);


	function close() {
		ui.showAdminPanel = false;
	}

	function getToken(): string | null {
		return sessionStorage.getItem('er-diagram:id-token');
	}


	async function fetchUsers(silent = false) {
		if (!silent) loading = true;
		if (!silent) errorMsg = '';
		try {
			const token = getToken();
			if (!token) { errorMsg = 'Not authenticated'; return; }

			const res = await fetch('/api/admin/set-plan', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${token}` }
			});

			if (!res.ok) {
				const data: any = await res.json().catch(() => ({}));
				throw new Error(data.message || `Error ${res.status}`);
			}

			const data = await res.json();
			users = data.users.filter((u: User) => u.sub !== auth.user?.sub);
			if (data.guests) guests = data.guests;
		} catch (err) {
			if (!silent) errorMsg = err instanceof Error ? err.message : 'Failed to load users';
		} finally {
			if (!silent) loading = false;
		}
	}

	async function fetchGuests(silent = false) {
		if (!silent) guestsLoading = true;
		if (!silent) errorMsg = '';
		try {
			const token = getToken();
			if (!token) { errorMsg = 'Not authenticated'; return; }

			const res = await fetch('/api/admin/guests', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${token}` }
			});

			if (!res.ok) {
				const data: any = await res.json().catch(() => ({}));
				throw new Error(data.message || `Error ${res.status}`);
			}

			const data = await res.json();
			guestList = data.guests ?? [];
		} catch (err) {
			if (!silent) errorMsg = err instanceof Error ? err.message : 'Failed to load guests';
		} finally {
			if (!silent) guestsLoading = false;
		}
	}

	async function confirmAndDeleteUser(user: User) {
		const label = user.name || user.email || formatSub(user.sub);
		const ok = await dialog.confirm({
			title: 'ยืนยันการลบผู้ใช้',
			message: `ลบ "${label}" ถาวร? ข้อมูล diagram และประวัติทั้งหมดของผู้ใช้จะถูกลบ กู้คืนไม่ได้`,
			confirmText: 'ลบถาวร',
			variant: 'danger'
		});
		if (!ok) return;

		actionLoading = user.sub;
		errorMsg = '';
		try {
			const token = getToken();
			if (!token) { errorMsg = 'Not authenticated'; return; }

			const res = await fetch('/api/admin/set-plan', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ target_sub: user.sub })
			});

			if (!res.ok) {
				const data: any = await res.json().catch(() => ({}));
				throw new Error(data.message || `Error ${res.status}`);
			}

			await fetchUsers();
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to delete user';
		} finally {
			actionLoading = null;
		}
	}

	async function confirmAndDeleteGuest(g: Guest) {
		const ok = await dialog.confirm({
			title: 'ยืนยันการลบ guest',
			message: `ลบ guest "${formatGuestId(g.guest_id)}" ออกจากรายการ? ถ้า guest คนนี้ยังใช้งานอยู่ ระบบจะบันทึกใหม่เมื่อมีการ ping ครั้งถัดไป`,
			confirmText: 'ลบ',
			variant: 'danger'
		});
		if (!ok) return;

		actionLoading = g.guest_id;
		errorMsg = '';
		try {
			const token = getToken();
			if (!token) { errorMsg = 'Not authenticated'; return; }

			const res = await fetch('/api/admin/guests', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ guest_id: g.guest_id })
			});

			if (!res.ok) {
				const data: any = await res.json().catch(() => ({}));
				throw new Error(data.message || `Error ${res.status}`);
			}

			await fetchGuests();
			await fetchUsers(true);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to delete guest';
		} finally {
			actionLoading = null;
		}
	}

	async function setPlan(targetSub: string, plan: 'basic' | 'advanced', days?: number) {
		actionLoading = targetSub;
		errorMsg = '';
		try {
			const token = getToken();
			if (!token) { errorMsg = 'Not authenticated'; return; }

			const body: any = { target_sub: targetSub, plan };
			if (plan === 'advanced' && days && days > 0) {
				body.expires_days = days;
			}

			const res = await fetch('/api/admin/set-plan', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const data: any = await res.json().catch(() => ({}));
				throw new Error(data.message || `Error ${res.status}`);
			}

			expandedRow = null;
			await fetchUsers();
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to update plan';
		} finally {
			actionLoading = null;
		}
	}

	function formatSub(sub: string): string {
		if (sub.length <= 12) return sub;
		return sub.slice(0, 6) + '...' + sub.slice(-4);
	}


	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function formatDateTime(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleString('th-TH', {
			month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
		});
	}

	function formatGuestId(id: string): string {
		const bare = id.replace(/^guest_/, '');
		return bare.length <= 10 ? bare : bare.slice(0, 8);
	}


	function refreshActive(silent = false) {
		if (tab === 'users') fetchUsers(silent);
		else fetchGuests(silent);
	}





	$effect(() => {
        if (!auth.isAdmin) return;
        if (!live) { refreshActive(false); return; }
        const abort = new AbortController();
        let retry: ReturnType<typeof setTimeout>;
        async function connect() {
            try {
                const token = getToken();
                if (!token) throw new Error('กรุณาเข้าสู่ระบบใหม่');
                const response = await fetch('/api/admin/events', { headers: { Authorization: `Bearer ${token}` }, signal: abort.signal });
                if (!response.ok || !response.body) throw new Error(`โหลดสถานะไม่สำเร็จ (${response.status})`);
                errorMsg = '';
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                while (!abort.signal.aborted) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    let boundary;
                    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
                        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
                        if (!frame.startsWith('data: ')) continue;
                        const data = JSON.parse(frame.slice(6));
                        users = data.users.filter((u: User) => u.sub !== auth.user?.sub);
                        guests = data.guests; guestList = data.guestList;
                    }
                }
            } catch (error) {
                if (!abort.signal.aborted) errorMsg = error instanceof Error ? error.message : 'การเชื่อมต่อขาดหาย';
            }
            if (!abort.signal.aborted) retry = setTimeout(connect, 5000);
        }
        void connect();
        return () => { abort.abort(); clearTimeout(retry); };
    });

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onkeydown={(e) => { if (e.key === 'Escape') close(); }}>
	<div class="relative mx-4 w-full max-w-2xl rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-6 shadow-2xl max-h-[80vh] flex flex-col">

		<button
			class="absolute right-4 top-4 rounded-lg p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			onclick={close}
			aria-label="Close"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>


		<div class="mb-4 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
				<svg class="h-5 w-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold text-[var(--ui-text)]">Admin Dashboard</h2>
				<p class="text-xs text-[var(--ui-text-muted)]">
					{users.length} users · {guests.total} guests
					<span class="inline-flex items-center gap-1">
						(<span class="inline-block h-1.5 w-1.5 rounded-full {totalOnline > 0 ? 'bg-green-500' : 'bg-gray-400'}"></span>{totalOnline} online<span class="text-[10px] opacity-70">· {guests.onlineUsers} user / {guests.active} guest</span>)
					</span>
				</p>
			</div>
		</div>


		<div class="mb-3 flex gap-1 border-b border-[var(--ui-border)]">
			<button
				class="relative px-3 py-1.5 text-xs font-medium transition {tab === 'users'
					? 'text-[var(--ui-text)]'
					: 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'}"
				onclick={() => (tab = 'users')}
			>
				Users ({users.length})
				{#if tab === 'users'}<span class="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--ui-accent)]"></span>{/if}
			</button>
			<button
				class="relative px-3 py-1.5 text-xs font-medium transition {tab === 'guests'
					? 'text-[var(--ui-text)]'
					: 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'}"
				onclick={() => (tab = 'guests')}
			>
				Guests ({guests.total})
				{#if tab === 'guests'}<span class="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--ui-accent)]"></span>{/if}
			</button>
		</div>


		{#if errorMsg}
			<div class="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-400">
				{errorMsg}
			</div>
		{/if}


		<div class="flex-1 overflow-y-auto min-h-0">
			{#if tab === 'users'}
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<svg class="h-6 w-6 animate-spin text-[var(--ui-text-muted)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
				</div>
			{:else if users.length === 0}
				<div class="py-12 text-center text-xs text-[var(--ui-text-muted)]">No users found</div>
			{:else}

				<div class="mb-3 inline-flex gap-1 rounded-lg bg-[var(--ui-hover)] p-0.5">
					<button
						class="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition {userFilter === 'online'
							? 'bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-sm'
							: 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'}"
						onclick={() => (userFilter = 'online')}
					>
						<span class="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
						Online ({onlineUsers.length})
					</button>
					<button
						class="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition {userFilter === 'offline'
							? 'bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-sm'
							: 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'}"
						onclick={() => (userFilter = 'offline')}
					>
						<span class="inline-block h-1.5 w-1.5 rounded-full bg-gray-400"></span>
						Offline ({offlineUsers.length})
					</button>
				</div>

				{#if shownUsers.length === 0}
					<div class="py-10 text-center text-xs text-[var(--ui-text-muted)]">
						{userFilter === 'online' ? 'ไม่มีผู้ใช้ออนไลน์ตอนนี้' : 'ไม่มีผู้ใช้ออฟไลน์'}
					</div>
				{:else}
				<table class="w-full text-xs">
					<thead>
						<tr class="border-b border-[var(--ui-border)] text-left text-[var(--ui-text-muted)]">
							<th class="pb-2 pr-3 font-medium">User</th>
							<th class="pb-2 pr-3 font-medium">Status</th>
							<th class="pb-2 pr-3 font-medium">Plan</th>
							<th class="pb-2 pr-3 font-medium">Expires</th>
							<th class="pb-2 pr-3 font-medium">Created</th>
							<th class="pb-2 font-medium">Action</th>
						</tr>
					</thead>
					<tbody>
						{#each shownUsers as user (user.sub)}
							<tr class="border-b border-[var(--ui-border-light)] hover:bg-[var(--ui-hover)]">
								<td class="py-2 pr-3" title={user.sub}>
									<div class="flex flex-col">
										{#if user.name}
											<span class="text-[var(--ui-text)] font-medium">{user.name}</span>
										{/if}
										{#if user.email}
											<span class="text-[10px] text-[var(--ui-text-muted)]">{user.email}</span>
										{:else}
											<span class="font-mono text-[var(--ui-text-secondary)]">{formatSub(user.sub)}</span>
										{/if}
									</div>
								</td>
								<td class="py-2 pr-3">
									{#if user.online}
										<span class="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
											<span class="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>online
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
											<span class="inline-block h-1.5 w-1.5 rounded-full bg-gray-400"></span>offline
										</span>
									{/if}
								</td>
								<td class="py-2 pr-3">
									{#if user.plan === 'advanced'}
										<span class="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">Advanced</span>
									{:else}
										<span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">Basic</span>
									{/if}
								</td>
								<td class="py-2 pr-3 text-[var(--ui-text-muted)]">{formatDate(user.plan_expires_at)}</td>
								<td class="py-2 pr-3 text-[var(--ui-text-muted)]">{formatDate(user.created_at)}</td>
								<td class="py-2">
									{#if expandedRow === user.sub}

										<div class="flex items-center gap-1">
											<input
												type="number"
												bind:value={expiresDays}
												min="1"
												max="3650"
												class="w-16 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-1.5 py-0.5 text-[11px] text-[var(--ui-text)] focus:outline-none focus:ring-1 focus:ring-purple-500"
												placeholder="Days"
											/>
											<span class="text-[10px] text-[var(--ui-text-muted)]">days</span>
											<button
												class="rounded bg-purple-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-purple-700 disabled:opacity-50"
												onclick={() => setPlan(user.sub, 'advanced', expiresDays)}
												disabled={actionLoading === user.sub}
											>
												{actionLoading === user.sub ? '...' : 'OK'}
											</button>
											<button
												class="rounded px-1.5 py-0.5 text-[10px] text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)]"
												onclick={() => expandedRow = null}
											>
												Cancel
											</button>
										</div>
									{:else}
										<div class="flex items-center gap-1">
											{#if user.plan === 'basic'}
												<button
													class="rounded bg-purple-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-purple-700 disabled:opacity-50"
													onclick={() => { expandedRow = user.sub; expiresDays = 30; }}
													disabled={actionLoading === user.sub}
												>
													Set Advanced
												</button>
											{:else}
												<button
													class="rounded border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-[10px] font-medium text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)] disabled:opacity-50"
													onclick={() => setPlan(user.sub, 'basic')}
													disabled={actionLoading === user.sub}
												>
													{actionLoading === user.sub ? '...' : 'Set Basic'}
												</button>
											{/if}

											<button
												class="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
												onclick={() => confirmAndDeleteUser(user)}
												disabled={actionLoading === user.sub}
												title="ลบผู้ใช้"
												aria-label="ลบผู้ใช้"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
											</button>
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{/if}
			{/if}
			{:else}

				{#if guestsLoading}
					<div class="flex items-center justify-center py-12">
						<svg class="h-6 w-6 animate-spin text-[var(--ui-text-muted)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
					</div>
				{:else if guestList.length === 0}
					<div class="py-12 text-center text-xs text-[var(--ui-text-muted)]">ยังไม่มี guest</div>
				{:else}

					<div class="mb-3 inline-flex gap-1 rounded-lg bg-[var(--ui-hover)] p-0.5">
						<button
							class="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition {guestFilter === 'online'
								? 'bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-sm'
								: 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'}"
							onclick={() => (guestFilter = 'online')}
						>
							<span class="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
							Online ({onlineGuests.length})
						</button>
						<button
							class="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition {guestFilter === 'offline'
								? 'bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-sm'
								: 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'}"
							onclick={() => (guestFilter = 'offline')}
						>
							<span class="inline-block h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							Offline ({offlineGuests.length})
						</button>
					</div>

					{#if shownGuests.length === 0}
						<div class="py-10 text-center text-xs text-[var(--ui-text-muted)]">
							{guestFilter === 'online' ? 'ไม่มี guest ออนไลน์ตอนนี้' : 'ไม่มี guest ออฟไลน์'}
						</div>
					{:else}
						<table class="w-full text-xs">
							<thead>
								<tr class="border-b border-[var(--ui-border)] text-left text-[var(--ui-text-muted)]">
									<th class="pb-2 pr-3 font-medium">Guest</th>
									<th class="pb-2 pr-3 font-medium">First seen</th>
									<th class="pb-2 pr-3 font-medium">Last seen</th>
									<th class="pb-2 pr-3 font-medium">Status</th>
									<th class="pb-2 font-medium">Action</th>
								</tr>
							</thead>
							<tbody>
								{#each shownGuests as g (g.guest_id)}
									<tr class="border-b border-[var(--ui-border-light)] hover:bg-[var(--ui-hover)]">
										<td class="py-2 pr-3 font-mono text-[var(--ui-text-secondary)]" title={g.guest_id}>{formatGuestId(g.guest_id)}</td>
										<td class="py-2 pr-3 text-[var(--ui-text-muted)]">{formatDateTime(g.first_seen)}</td>
										<td class="py-2 pr-3 text-[var(--ui-text-muted)]">{formatDateTime(g.last_seen)}</td>
										<td class="py-2 pr-3">
											{#if g.online}
												<span class="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
													<span class="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>online
												</span>
											{:else}
												<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
													<span class="inline-block h-1.5 w-1.5 rounded-full bg-gray-400"></span>offline
												</span>
											{/if}
										</td>
										<td class="py-2">
											<button
												class="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
												onclick={() => confirmAndDeleteGuest(g)}
												disabled={actionLoading === g.guest_id}
												title="ลบ guest"
												aria-label="ลบ guest"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				{/if}
			{/if}
		</div>


		<div class="mt-4 flex items-center justify-between">
			<button
				class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition hover:bg-[var(--ui-hover)]"
				onclick={() => (live = !live)}
				title={live ? 'อัปเดตอัตโนมัติทุก 5 วิ — กดเพื่อหยุด' : 'กดเพื่อเปิดอัปเดตอัตโนมัติ'}
			>
				<span class="relative flex h-2 w-2">
					{#if live}
						<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
					{:else}
						<span class="relative inline-flex h-2 w-2 rounded-full bg-gray-400"></span>
					{/if}
				</span>
				<span class="text-[var(--ui-text-secondary)]">{live ? 'Live' : 'Paused'}</span>
			</button>
			<button
				class="rounded-lg border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)] disabled:opacity-50"
				onclick={() => refreshActive(false)}
				disabled={loading || guestsLoading}
			>
				Refresh
			</button>
		</div>
	</div>
</div>
