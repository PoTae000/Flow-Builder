<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import type { ChatMessage } from '$lib/stores/collab.svelte';
	import { tick } from 'svelte';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	const MAX_MSG_LENGTH = 2000;
	const MAX_MESSAGES = 200;

	let localMessages = $state<ChatMessage[]>([]);
	let input = $state('');
	let loading = $state(false);
	let messagesEl: HTMLDivElement | undefined = $state();
	let localBackup = $state<ChatMessage[]>([]);
	let showUndo = $state(false);
	let undoTimer: ReturnType<typeof setTimeout> | null = null;

	function clearMessages() {
		if (isCollab) {
			collab.clearChat();
		} else {
			localBackup = [...localMessages];
			localMessages = [];
		}
		showUndo = true;
		if (undoTimer) clearTimeout(undoTimer);
		undoTimer = setTimeout(() => { showUndo = false; }, 5000);
	}

	function undoClear() {
		if (isCollab) {
			collab.restoreChat();
		} else {
			localMessages = localBackup;
			localBackup = [];
		}
		showUndo = false;
		if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
	}

	/** Use collab chat when connected, otherwise local */
	const isCollab = $derived(collab.connected && collab.users.length > 0);
	const messages = $derived<ChatMessage[]>(isCollab ? collab.chatMessages : localMessages);

	const suggestions = [
		'Diagram นี้ Normalize ถูกมั้ย?',
		'ควรเพิ่ม Entity อะไรอีก?',
		'Cardinality ถูกต้องมั้ย?',
		'ออกแบบระบบจองโรงแรมให้หน่อย'
	];

	function myName(): string {
		return collab.userName || 'Anonymous';
	}

	function myPicture(): string {
		return collab.userPicture || '';
	}

	async function send(text?: string) {
		const raw = text || input.trim();
		if (!raw || loading) return;
		const msg = raw.slice(0, MAX_MSG_LENGTH);
		input = '';

		const userMsg: ChatMessage = {
			role: 'user',
			content: msg,
			senderName: isCollab ? myName() : undefined,
			senderPicture: isCollab ? myPicture() : undefined
		};

		if (isCollab) {
			collab.pushChatMessage(userMsg);
		} else {
			localMessages = [...localMessages, userMsg];
			if (localMessages.length > MAX_MESSAGES) {
				localMessages = localMessages.slice(-MAX_MESSAGES);
			}
		}

		loading = true;

		await tick();
		scrollToBottom();

		try {
			// Build messages array for API (strip sender info)
			const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: apiMessages,
					entities: $state.snapshot(diagram.entities),
					relationships: $state.snapshot(diagram.relationships)
				})
			});

			let reply = 'ขอโทษ ตอบไม่ได้ตอนนี้ ลองใหม่นะ';
			if (res.ok) {
				try {
					const data: any = await res.json();
					reply = data.content || reply;
				} catch {
					reply = 'AI ส่งข้อมูลกลับมาไม่ถูกต้อง ลองใหม่นะ';
				}
			}

			const assistantMsg: ChatMessage = { role: 'assistant', content: reply };

			if (isCollab) {
				collab.pushChatMessage(assistantMsg);
			} else {
				localMessages = [...localMessages, assistantMsg];
			}
		} catch {
			const errMsg: ChatMessage = { role: 'assistant', content: 'เชื่อมต่อไม่ได้ ลองใหม่' };
			if (isCollab) {
				collab.pushChatMessage(errMsg);
			} else {
				localMessages = [...localMessages, errMsg];
			}
		} finally {
			loading = false;
			await tick();
			scrollToBottom();
		}
	}

	function scrollToBottom() {
		if (messagesEl) {
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}
	}

	// Auto-scroll when new messages arrive from collab
	$effect(() => {
		messages.length;
		tick().then(scrollToBottom);
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<!-- Slide-over panel from right -->
<div class="fixed inset-y-0 right-0 z-40 flex w-full md:w-[380px] flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl panel-slide-in">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">AI Chat</h2>
			{#if isCollab}
				<span class="rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400">
					ห้องรวม
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-1">
			{#if messages.length > 0 && (!isCollab || collab.isHost)}
				<button
					onclick={clearMessages}
					class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-red-500"
					title="ล้างแชท"
					aria-label="ล้างแชท"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
				</button>
			{/if}
			<button onclick={onclose} class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)]" aria-label="ปิด">
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
			</button>
		</div>
	</div>

	<!-- Undo toast -->
	{#if showUndo && messages.length === 0}
		<div class="flex items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-4 py-2">
			<span class="text-xs text-[var(--ui-text-muted)]">ล้างแชทแล้ว</span>
			<button
				onclick={undoClear}
				class="rounded px-2.5 py-1 text-xs font-medium text-[var(--ui-accent)] transition hover:bg-[var(--ui-hover)]"
			>
				ย้อนกลับ
			</button>
		</div>
	{/if}

	<!-- Messages -->
	<div class="flex-1 overflow-y-auto p-4" bind:this={messagesEl}>
		{#if messages.length === 0}
			<div class="flex flex-col items-center gap-3 py-8 text-center">
				<svg class="h-10 w-10 text-[var(--ui-text-muted)] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
				<p class="text-xs text-[var(--ui-text-muted)]">
					{isCollab ? 'แชทร่วมกับทุกคนในห้อง' : 'ถามอะไรก็ได้เกี่ยวกับ ER Diagram'}
				</p>
				<div class="flex flex-wrap justify-center gap-1.5">
					{#each suggestions as s}
						<button
							onclick={() => send(s)}
							class="rounded-full border border-[var(--ui-border)] px-2.5 py-1 text-[10px] text-[var(--ui-text-muted)] transition hover:border-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]"
						>
							{s}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#each messages as msg}
			<div class="mb-3 {msg.role === 'user' ? 'flex justify-end' : ''}">
				{#if msg.role === 'user'}
					<!-- User message -->
					<div class="flex max-w-[85%] flex-col items-end gap-0.5">
						{#if isCollab && msg.senderName}
							<div class="flex items-center gap-1 px-1">
								{#if msg.senderPicture}
									<img src={msg.senderPicture} alt="" class="h-3.5 w-3.5 rounded-full" referrerpolicy="no-referrer" />
								{/if}
								<span class="text-[10px] text-[var(--ui-text-muted)]">{msg.senderName}</span>
							</div>
						{/if}
						<div class="rounded-2xl rounded-br-md bg-[var(--ui-accent)] px-3 py-2 text-xs text-[var(--ui-accent-text)]">
							<div class="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
						</div>
					</div>
				{:else}
					<!-- AI message -->
					<div class="max-w-[90%] rounded-2xl rounded-bl-md border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)]">
						<div class="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
					</div>
				{/if}
			</div>
		{/each}

		{#if loading}
			<div class="mb-3">
				<div class="max-w-[90%] rounded-2xl rounded-bl-md border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2">
					<div class="flex items-center gap-1 mb-2">
						<span class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ui-text-muted)]" style="animation-delay: 0ms"></span>
						<span class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ui-text-muted)]" style="animation-delay: 150ms"></span>
						<span class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ui-text-muted)]" style="animation-delay: 300ms"></span>
					</div>
					<div class="flex flex-col gap-1.5">
						<div class="skeleton h-3 w-full"></div>
						<div class="skeleton h-3 w-4/5"></div>
						<div class="skeleton h-3 w-3/5"></div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Input -->
	<div class="border-t border-[var(--ui-border)] p-3">
		<div class="flex items-end gap-2">
			<textarea
				bind:value={input}
				onkeydown={handleKeydown}
				placeholder="พิมพ์ข้อความ..."
				rows="1"
				maxlength={MAX_MSG_LENGTH}
				class="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] placeholder-[var(--ui-text-muted)] focus:ring-1 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
			></textarea>
			<button
				onclick={() => send()}
				disabled={!input.trim() || loading}
				class="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ui-accent)] text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-40"
				aria-label="ส่ง"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
			</button>
		</div>
	</div>
</div>
