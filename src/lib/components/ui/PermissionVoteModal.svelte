<script lang="ts">
	import { collab } from '$lib/stores/collab.svelte';

	const ACTION_LABELS: Record<string, string> = {
		'import': 'นำเข้าข้อมูล (Import)',
		'ai-analysis': 'วิเคราะห์ AI (Analysis/Fix)',
		'translate': 'แปลภาษา (Translate)',
		'auto-layout': 'จัดวาง Layout อัตโนมัติ',
		'presentation': 'เปิดโหมดนำเสนอ',
		'change-notation': 'เปลี่ยน Notation',
		'change-font': 'เปลี่ยน Font',
		'domain-starter': 'สร้าง Diagram จากโดเมน (Domain Starter)',
		'templates': 'ใช้เทมเพลต (Templates)',
	};

	const request = $derived(collab.permissionRequest);
	const votes = $derived(collab.permissionVotes);
	const isRequester = $derived(
		request !== null && request.requesterClientId === collab.localClientId
	);
	const hasVoted = $derived(
		request !== null && votes.has(collab.localClientId)
	);

	// Count votes
	const approveCount = $derived.by(() => {
		let count = 0;
		votes.forEach((v) => { if (v === 'approve') count++; });
		return count;
	});
	const totalVoters = $derived(request?.voterClientIds.length ?? 0);

	// Elapsed time for timeout display
	let elapsed = $state(0);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		if (request) {
			elapsed = Math.floor((Date.now() - request.createdAt) / 1000);
			intervalId = setInterval(() => {
				elapsed = Math.floor((Date.now() - request!.createdAt) / 1000);
			}, 1000);
		} else {
			elapsed = 0;
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = null;
			}
		}
		return () => {
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};
	});

	const remaining = $derived(Math.max(0, 60 - elapsed));
</script>

{#if request}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px] animate-fade-in"
		onclick={() => {}}
		onkeydown={() => {}}
	></div>

	<!-- Modal -->
	<div class="fixed left-1/2 top-1/2 z-[71] w-[380px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-5 shadow-2xl animate-scale-in">
		{#if isRequester}
			<!-- Requester view -->
			<div class="mb-4 flex items-start gap-3">
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
					<svg class="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				</div>
				<div>
					<h3 class="text-sm font-medium text-[var(--ui-text)]">กำลังรอการอนุมัติ</h3>
					<p class="mt-1 text-xs text-[var(--ui-text-muted)]">
						{ACTION_LABELS[request.action] ?? request.action} — รอให้คนอื่นในห้องอนุมัติ
					</p>
				</div>
			</div>

			<!-- Progress bar -->
			<div class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ui-border)]">
				<div
					class="h-full rounded-full bg-blue-500 transition-all duration-1000"
					style="width: {totalVoters > 0 ? (approveCount / totalVoters) * 100 : 0}%"
				></div>
			</div>

			<!-- Vote status list -->
			<div class="mb-4 space-y-1.5 max-h-40 overflow-y-auto">
				{#each request.voterClientIds as voterId}
					{@const vote = votes.get(voterId)}
					{@const user = collab.users.find(u => u.id === voterId)}
					<div class="flex items-center justify-between rounded-lg bg-[var(--ui-bg-secondary)] px-3 py-1.5">
						<div class="flex items-center gap-2">
							{#if user?.picture}
								<img src={user.picture} alt="" class="h-5 w-5 rounded-full" />
							{:else}
								<div class="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ui-border)] text-[10px] font-medium text-[var(--ui-text-muted)]">
									{(user?.name ?? '?')[0]}
								</div>
							{/if}
							<span class="text-xs text-[var(--ui-text)]">{user?.name ?? 'Unknown'}</span>
						</div>
						<span class="text-xs {vote === 'approve' ? 'text-green-500' : vote === 'deny' ? 'text-red-500' : 'text-[var(--ui-text-muted)]'}">
							{#if vote === 'approve'}
								อนุมัติแล้ว
							{:else if vote === 'deny'}
								ปฏิเสธ
							{:else if !collab.users.find(u => u.id === voterId)}
								ออกไปแล้ว
							{:else}
								รอ...
							{/if}
						</span>
					</div>
				{/each}
			</div>

			<!-- Timeout + Cancel -->
			<div class="flex items-center justify-between">
				<span class="text-xs text-[var(--ui-text-muted)]">หมดเวลาใน {remaining}s</span>
				<button
					onclick={() => collab.cancelPermissionRequest()}
					class="rounded-lg border border-[var(--ui-border)] px-4 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>
					ยกเลิก
				</button>
			</div>
		{:else if !hasVoted}
			<!-- Voter view: hasn't voted yet -->
			<div class="mb-4 flex items-start gap-3">
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
					<svg class="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
				</div>
				<div>
					<h3 class="text-sm font-medium text-[var(--ui-text)]">ขออนุญาต</h3>
					<p class="mt-1 text-xs text-[var(--ui-text-muted)]">
						<span class="font-medium text-[var(--ui-text)]">{request.requesterName}</span>
						ต้องการ{ACTION_LABELS[request.action] ?? request.action}
					</p>
				</div>
			</div>

			<!-- Requester avatar -->
			<div class="mb-4 flex items-center gap-3 rounded-lg bg-[var(--ui-bg-secondary)] px-3 py-2">
				{#if request.requesterPicture}
					<img src={request.requesterPicture} alt="" class="h-8 w-8 rounded-full" />
				{:else}
					<div class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ui-border)] text-sm font-medium text-[var(--ui-text-muted)]">
						{request.requesterName[0]}
					</div>
				{/if}
				<div>
					<div class="text-sm font-medium text-[var(--ui-text)]">{request.requesterName}</div>
					<div class="text-xs text-[var(--ui-text-muted)]">{ACTION_LABELS[request.action] ?? request.action}</div>
				</div>
			</div>

			<!-- Vote buttons -->
			<div class="flex justify-end gap-2">
				<button
					onclick={() => collab.submitVote('deny')}
					class="rounded-lg border border-[var(--ui-border)] px-4 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500"
				>
					ปฏิเสธ
				</button>
				<button
					onclick={() => collab.submitVote('approve')}
					class="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-green-700"
				>
					อนุญาต
				</button>
			</div>

			<div class="mt-3 text-right">
				<span class="text-xs text-[var(--ui-text-muted)]">หมดเวลาใน {remaining}s</span>
			</div>
		{:else}
			<!-- Voter view: already voted, waiting for result -->
			<div class="mb-4 flex items-start gap-3">
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
					<svg class="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				</div>
				<div>
					<h3 class="text-sm font-medium text-[var(--ui-text)]">
						{votes.get(collab.localClientId) === 'approve' ? 'คุณอนุมัติแล้ว' : 'คุณปฏิเสธแล้ว'}
					</h3>
					<p class="mt-1 text-xs text-[var(--ui-text-muted)]">รอผลจากคนอื่นในห้อง...</p>
				</div>
			</div>

			<!-- Progress -->
			<div class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ui-border)]">
				<div
					class="h-full rounded-full bg-blue-500 transition-all duration-1000"
					style="width: {totalVoters > 0 ? (approveCount / totalVoters) * 100 : 0}%"
				></div>
			</div>

			<div class="text-right">
				<span class="text-xs text-[var(--ui-text-muted)]">อนุมัติ {approveCount}/{totalVoters} — หมดเวลาใน {remaining}s</span>
			</div>
		{/if}
	</div>
{/if}
