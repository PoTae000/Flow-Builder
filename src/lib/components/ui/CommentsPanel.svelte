<script lang="ts">
	import { dockPanel } from '$lib/utils/dock-transition';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import type { Comment } from '$lib/types/comment';

	let { onclose }: { onclose: () => void } = $props();

	let draft = $state('');
	let replyDraft = $state('');
	let replyingTo = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let editDraft = $state('');

	const target = $derived(diagram.commentTarget);

	
	const roots = $derived.by(() => {
		if (!target) return [];
		return diagram
			.commentsForTarget(target.id)
			.filter((c) => !c.parentId)
			.sort((a, b) => a.createdAt - b.createdAt);
	});

	function repliesFor(rootId: string): Comment[] {
		if (!target) return [];
		return diagram
			.commentsForTarget(target.id)
			.filter((c) => c.parentId === rootId)
			.sort((a, b) => a.createdAt - b.createdAt);
	}

	function authorName(): string {
		return collab.userName || auth.user?.name || 'Anonymous';
	}

	function submitRoot() {
		if (!target || !draft.trim()) return;
		diagram.addComment(target.id, target.type, draft.trim(), authorName());
		draft = '';
	}

	function submitReply(rootId: string) {
		if (!target || !replyDraft.trim()) return;
		diagram.addComment(target.id, target.type, replyDraft.trim(), authorName(), rootId);
		replyDraft = '';
		replyingTo = null;
	}

	function startEdit(c: Comment) {
		editingId = c.id;
		editDraft = c.text;
	}

	function saveEdit() {
		if (editingId && editDraft.trim()) {
			diagram.updateComment(editingId, editDraft.trim());
		}
		editingId = null;
		editDraft = '';
	}

	function formatTime(ts: number): string {
		try {
			return new Date(ts).toLocaleString(undefined, {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return '';
		}
	}

	function initials(name: string): string {
		return name.trim().slice(0, 2).toUpperCase() || '?';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />


<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 bg-black/30 animate-fade-in" data-panel-backdrop onclick={onclose}></div>


<div class="fixed right-0 top-0 z-50 flex h-full w-full md:w-[400px] md:max-w-[92vw] flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl panel-slide-in" data-workspace-panel transition:dockPanel|global>
	
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">ความคิดเห็น</h2>
		</div>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	
	<div class="flex-1 overflow-y-auto p-5">
		{#if !target}
			<div class="flex flex-col items-center gap-2 py-10 text-center">
				<svg class="h-8 w-8 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
				<p class="text-xs text-[var(--ui-text-muted)]">
					เลือก entity, node, relationship หรือ edge หนึ่งชิ้น เพื่อดู/เพิ่มความคิดเห็น
				</p>
			</div>
		{:else}
			
			<div class="mb-3 flex items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2">
				<span class="rounded bg-[var(--ui-accent)]/15 px-1.5 py-0.5 text-[10px] uppercase text-[var(--ui-accent)]">{target.type}</span>
				<span class="truncate text-xs font-medium text-[var(--ui-text)]">{target.name}</span>
			</div>

			
			{#if roots.length === 0}
				<p class="py-4 text-center text-xs text-[var(--ui-text-muted)]">ยังไม่มีความคิดเห็น — เริ่มการสนทนาได้เลย</p>
			{/if}

			<div class="space-y-3">
				{#each roots as c (c.id)}
					<div class="rounded-lg border border-[var(--ui-border)] p-3 {c.resolved ? 'opacity-55' : ''}">
						
						<div class="flex items-start gap-2">
							<div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ui-accent)]/20 text-[9px] font-medium text-[var(--ui-accent)]">
								{initials(c.authorName)}
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-1.5">
									<span class="text-xs font-medium text-[var(--ui-text)]">{c.authorName}</span>
									<span class="text-[10px] text-[var(--ui-text-muted)]">{formatTime(c.createdAt)}</span>
									{#if c.resolved}
										<span class="ml-auto rounded bg-green-500/15 px-1.5 py-0.5 text-[9px] text-green-600 dark:text-green-400">แก้แล้ว</span>
									{/if}
								</div>
								{#if editingId === c.id}
									<textarea
										bind:value={editDraft}
										class="mt-1 w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1 text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
										rows="2"
									></textarea>
									<div class="mt-1 flex gap-2">
										<button onclick={saveEdit} class="text-[11px] text-[var(--ui-accent)] hover:underline">บันทึก</button>
										<button onclick={() => { editingId = null; }} class="text-[11px] text-[var(--ui-text-muted)] hover:underline">ยกเลิก</button>
									</div>
								{:else}
									<p class="mt-0.5 whitespace-pre-wrap break-words text-xs text-[var(--ui-text-secondary)]">{c.text}</p>
									<div class="mt-1.5 flex flex-wrap gap-3">
										<button onclick={() => { replyingTo = replyingTo === c.id ? null : c.id; replyDraft = ''; }} class="text-[11px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]">ตอบกลับ</button>
										<button onclick={() => diagram.toggleCommentResolved(c.id)} class="text-[11px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]">{c.resolved ? 'เปิดใหม่' : 'ทำเครื่องหมายแก้แล้ว'}</button>
										<button onclick={() => startEdit(c)} class="text-[11px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]">แก้ไข</button>
										<button onclick={() => diagram.removeComment(c.id)} class="text-[11px] text-red-500/80 hover:text-red-500">ลบ</button>
									</div>
								{/if}
							</div>
						</div>

						
						{#each repliesFor(c.id) as r (r.id)}
							<div class="mt-2 ml-8 flex items-start gap-2 border-l border-[var(--ui-border)] pl-2">
								<div class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ui-bg-tertiary)] text-[8px] font-medium text-[var(--ui-text-secondary)]">
									{initials(r.authorName)}
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-1.5">
										<span class="text-[11px] font-medium text-[var(--ui-text)]">{r.authorName}</span>
										<span class="text-[9px] text-[var(--ui-text-muted)]">{formatTime(r.createdAt)}</span>
									</div>
									{#if editingId === r.id}
										<textarea
											bind:value={editDraft}
											class="mt-1 w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1 text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
											rows="2"
										></textarea>
										<div class="mt-1 flex gap-2">
											<button onclick={saveEdit} class="text-[11px] text-[var(--ui-accent)] hover:underline">บันทึก</button>
											<button onclick={() => { editingId = null; }} class="text-[11px] text-[var(--ui-text-muted)] hover:underline">ยกเลิก</button>
										</div>
									{:else}
										<p class="mt-0.5 whitespace-pre-wrap break-words text-[11px] text-[var(--ui-text-secondary)]">{r.text}</p>
										<div class="mt-1 flex gap-3">
											<button onclick={() => startEdit(r)} class="text-[10px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]">แก้ไข</button>
											<button onclick={() => diagram.removeComment(r.id)} class="text-[10px] text-red-500/80 hover:text-red-500">ลบ</button>
										</div>
									{/if}
								</div>
							</div>
						{/each}

						
						{#if replyingTo === c.id}
							<div class="mt-2 ml-8">
								<textarea
									bind:value={replyDraft}
									placeholder="เขียนคำตอบ..."
									rows="2"
									class="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1 text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
									onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitReply(c.id); }}
								></textarea>
								<div class="mt-1 flex justify-end gap-2">
									<button onclick={() => { replyingTo = null; }} class="text-[11px] text-[var(--ui-text-muted)] hover:underline">ยกเลิก</button>
									<button onclick={() => submitReply(c.id)} disabled={!replyDraft.trim()} class="rounded bg-[var(--ui-accent)] px-2.5 py-1 text-[11px] text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-50">ตอบ</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	
	{#if target}
		<div class="border-t border-[var(--ui-border)] p-4">
			<textarea
				bind:value={draft}
				placeholder="เพิ่มความคิดเห็น... (Ctrl+Enter เพื่อส่ง)"
				rows="2"
				class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)] resize-none"
				onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitRoot(); }}
			></textarea>
			<div class="mt-2 flex justify-end">
				<button
					onclick={submitRoot}
					disabled={!draft.trim()}
					class="rounded bg-[var(--ui-accent)] px-4 py-1.5 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-50"
				>
					ส่งความคิดเห็น
				</button>
			</div>
		</div>
	{/if}
</div>
