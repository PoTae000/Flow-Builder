<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { auth } from '$lib/stores/auth.svelte';

	interface User {
		sub: string;
		email: string | null;
		name: string | null;
		plan: string;
		plan_expires_at: string | null;
		stripe_customer_id: string | null;
		created_at: string;
	}

	let users = $state<User[]>([]);
	let loading = $state(false);
	let errorMsg = $state('');
	let actionLoading = $state<string | null>(null);
	let expandedRow = $state<string | null>(null);
	let expiresDays = $state(30);

	function close() {
		ui.showAdminPanel = false;
	}

	function getToken(): string | null {
		return sessionStorage.getItem('er-diagram:id-token');
	}

	async function fetchUsers() {
		loading = true;
		errorMsg = '';
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
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to load users';
		} finally {
			loading = false;
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

	// Fetch users on mount
	$effect(() => {
		if (auth.isAdmin) {
			fetchUsers();
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onkeydown={(e) => { if (e.key === 'Escape') close(); }}>
	<div class="relative mx-4 w-full max-w-2xl rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-6 shadow-2xl max-h-[80vh] flex flex-col">
		<!-- Close button -->
		<button
			class="absolute right-4 top-4 rounded-lg p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			onclick={close}
			aria-label="Close"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>

		<!-- Header -->
		<div class="mb-4 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
				<svg class="h-5 w-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold text-[var(--ui-text)]">Admin Dashboard</h2>
				<p class="text-xs text-[var(--ui-text-muted)]">{users.length} users</p>
			</div>
		</div>

		<!-- Error -->
		{#if errorMsg}
			<div class="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-400">
				{errorMsg}
			</div>
		{/if}

		<!-- User table -->
		<div class="flex-1 overflow-y-auto min-h-0">
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<svg class="h-6 w-6 animate-spin text-[var(--ui-text-muted)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
				</div>
			{:else if users.length === 0}
				<div class="py-12 text-center text-xs text-[var(--ui-text-muted)]">No users found</div>
			{:else}
				<table class="w-full text-xs">
					<thead>
						<tr class="border-b border-[var(--ui-border)] text-left text-[var(--ui-text-muted)]">
							<th class="pb-2 pr-3 font-medium">User</th>
							<th class="pb-2 pr-3 font-medium">Plan</th>
							<th class="pb-2 pr-3 font-medium">Expires</th>
							<th class="pb-2 pr-3 font-medium">Created</th>
							<th class="pb-2 font-medium">Action</th>
						</tr>
					</thead>
					<tbody>
						{#each users as user (user.sub)}
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
										<!-- Inline expires_days input -->
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
									{:else if user.plan === 'basic'}
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
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>

		<!-- Refresh button -->
		<div class="mt-4 flex justify-end">
			<button
				class="rounded-lg border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)] disabled:opacity-50"
				onclick={fetchUsers}
				disabled={loading}
			>
				Refresh
			</button>
		</div>
	</div>
</div>
