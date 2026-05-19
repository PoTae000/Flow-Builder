<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import type { ChatMessage } from '$lib/stores/collab.svelte';
	import { agent } from '$lib/stores/agent.svelte';
	import type { AgentAction } from '$lib/types/agent';
	import { tick } from 'svelte';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	const MAX_MSG_LENGTH = 2000;
	const MAX_MESSAGES = 200;

	interface ChatActionData {
		actions: AgentAction[];
		appliedBy?: string;
	}

	interface LocalMessage extends ChatMessage {
		action?: ChatActionData;
	}

	let localMessages = $state<LocalMessage[]>([]);
	let input = $state('');
	let loading = $state(false);
	let messagesEl: HTMLDivElement | undefined = $state();
	let localBackup = $state<LocalMessage[]>([]);
	let showUndo = $state(false);
	let undoTimer: ReturnType<typeof setTimeout> | null = null;
	let agentMode = $state(false);

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
	const messages = $derived<LocalMessage[]>(isCollab ? collab.chatMessages : localMessages);

	const diagramTypeLabel = $derived(
		diagram.diagramType === 'flowchart' ? 'Flowchart' :
		diagram.diagramType === 'context' ? 'DFD' :
		'ER Diagram'
	);

	const suggestions = $derived<string[]>(
		diagram.diagramType === 'flowchart' ? [
			'Flow นี้ถูกต้องมั้ย?',
			'มี Dead End มั้ย?',
			'ออกแบบ Login Process ให้หน่อย',
			'เพิ่ม Error Handling ให้หน่อย'
		] : diagram.diagramType === 'context' ? [
			'Data Flow สมดุลมั้ย?',
			'External Entity ครบมั้ย?',
			'ออกแบบระบบ E-commerce ให้หน่อย',
			'เพิ่ม Data Store ที่ขาดให้หน่อย'
		] : [
			'สร้างระบบ E-commerce ให้หน่อย',
			'Diagram นี้ Normalize ถูกมั้ย?',
			'ควรเพิ่ม Entity อะไรอีก?',
			'ออกแบบระบบจองโรงแรมให้หน่��ย'
		]
	);

	function myName(): string {
		return collab.userName || 'Anonymous';
	}

	function myPicture(): string {
		return collab.userPicture || '';
	}

	function formatActionSummary(actions: AgentAction[]): string {
		const counts: Record<string, number> = {};
		for (const a of actions) {
			const key = a.op.startsWith('add-') ? 'เพ��่ม' : a.op.startsWith('remove-') ? 'ลบ' : '���ก้ไ��';
			counts[key] = (counts[key] || 0) + 1;
		}
		return Object.entries(counts).map(([k, v]) => `${k} ${v} รายการ`).join(', ');
	}

	function formatActionDetail(action: AgentAction): string {
		switch (action.op) {
			case 'add-entity': return `+ Entity: ${action.name}`;
			case 'remove-entity': return `- Entity: ${action.name}`;
			case 'rename-entity': return `~ Entity: ${action.name} → ${action.newName}`;
			case 'add-attribute': return `+ Attr: ${action.entityName}.${action.attribute.name}`;
			case 'remove-attribute': return `- Attr: ${action.entityName}.${action.attributeName}`;
			case 'add-relationship': return `+ Rel: ${action.from} → ${action.to} (${action.name})`;
			case 'remove-relationship': return `- Rel: ${action.name}`;
			case 'modify-relationship': return `~ Rel: ${action.name}`;
			case 'add-flow-node': return `+ Node: ${action.name} [${action.type}]`;
			case 'remove-flow-node': return `- Node: ${action.name}`;
			case 'add-flow-edge': return `+ Edge: ${action.fromNode} → ${action.toNode}`;
			case 'remove-flow-edge': return `- Edge: ${action.fromNode} → ${action.toNode}`;
			case 'add-dfd-node': return `+ Node: ${action.name} [${action.type}]`;
			case 'remove-dfd-node': return `- Node: ${action.name}`;
			case 'add-dfd-flow': return `+ Flow: ${action.fromNode} → ${action.toNode}`;
			case 'remove-dfd-flow': return `- Flow: ${action.fromNode} → ${action.toNode}`;
			case 'auto-layout': return '⟳ Auto Layout';
		}
	}

	async function send(text?: string) {
		const raw = text || input.trim();
		if (!raw || loading) return;
		const msg = raw.slice(0, MAX_MSG_LENGTH);
		input = '';

		const userMsg: LocalMessage = {
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

		// Agent mode: use autonomous agent
		if (agentMode) {
			loading = true;
			await tick();
			scrollToBottom();

			agent.executeAgent(msg).then(() => {
				const summary = agent.steps.every(s => s.status === 'done')
					? `เสร็จแล้ว! ทำไป ${agent.steps.length} ขั้นตอน`
					: `หยุดที่ขั้นตอนที่ ${agent.steps.findIndex(s => s.status === 'error') + 1}`;

				const assistantMsg: LocalMessage = { role: 'assistant', content: summary };
				if (isCollab) {
					collab.pushChatMessage(assistantMsg);
				} else {
					localMessages = [...localMessages, assistantMsg];
				}
				loading = false;
			});
			return;
		}

		loading = true;

		await tick();
		scrollToBottom();

		try {
			// Build messages array for API (strip sender info and action data)
			const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

			// Build type-aware request body
			let body: any = {
				messages: apiMessages,
				diagramType: diagram.diagramType
			};

			if (diagram.diagramType === 'flowchart') {
				body.flowNodes = $state.snapshot(diagram.flowNodes);
				body.flowEdges = $state.snapshot(diagram.flowEdges);
			} else if (diagram.diagramType === 'context') {
				body.dfdNodes = $state.snapshot(diagram.dfdNodes);
				body.dfdFlows = $state.snapshot(diagram.dfdFlows);
			} else {
				body.entities = $state.snapshot(diagram.entities);
				body.relationships = $state.snapshot(diagram.relationships);
			}

			const res = await fetch('/api/chat-action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			let reply = 'ขอโทษ ตอบไม่ได้ตอนนี้ ลองใหม่นะ';
			let action: ChatActionData | undefined = undefined;

			if (res.ok) {
				try {
					const data: any = await res.json();
					reply = data.content || reply;
					// Parse actions from response
					if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
						action = { actions: data.actions };
					}
				} catch {
					reply = 'AI ส่งข้อมูลกลับมาไม่ถูกต้อง ลองใหม่นะ';
				}
			}

			const assistantMsg: LocalMessage = { role: 'assistant', content: reply, action };

			if (isCollab) {
				collab.pushChatMessage({ role: 'assistant', content: reply, action: action || undefined });
			} else {
				localMessages = [...localMessages, assistantMsg];
			}
		} catch {
			const errMsg: LocalMessage = { role: 'assistant', content: 'เชื่อมต่อไม่ได้ ลองใหม่' };
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

	function canApplyAction(msg: LocalMessage): boolean {
		if (!msg?.action || msg.action.appliedBy) return false;
		if (!isCollab) return true;
		if (collab.isHost) return true;
		const idx = messages.indexOf(msg);
		if (idx > 0) {
			const prev = messages[idx - 1];
			if (prev.role === 'user' && prev.senderName === myName()) return true;
		}
		return false;
	}

	function applyAction(msgIndex: number) {
		const msg = messages[msgIndex];
		if (!msg?.action || msg.action.appliedBy) return;

		diagram.pushHistory('AI Chat');
		agent.applyActions(msg.action.actions);

		// Mark as applied
		if (isCollab) {
			collab.markChatActionApplied(msgIndex, myName());
		} else {
			localMessages = localMessages.map((m, i) =>
				i === msgIndex ? { ...m, action: m.action ? { ...m.action, appliedBy: myName() } : undefined } : m
			);
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
			<!-- Agent mode toggle -->
			<button
				onclick={() => agentMode = !agentMode}
				class="rounded p-1 transition {agentMode ? 'bg-[var(--ui-accent)]/10 text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text-secondary)]'}"
				title={agentMode ? 'Agent Mode: ON' : 'Agent Mode: OFF'}
				aria-label="Toggle Agent Mode"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
			</button>
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

	<!-- Agent mode banner -->
	{#if agentMode}
		<div class="flex items-center gap-2 border-b border-[var(--ui-border)] bg-[var(--ui-accent)]/5 px-4 py-2">
			<svg class="h-3.5 w-3.5 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
			<span class="text-[11px] text-[var(--ui-accent)]">Agent Mode — พิมพ์คำสั่งแล้ว AI จะสร้าง diagram อัตโนมัติ</span>
		</div>
	{/if}

	<!-- Agent progress (when running) -->
	{#if agent.running || agent.steps.length > 0}
		<div class="border-b border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-4 py-3">
			<div class="mb-2 flex items-center justify-between">
				<span class="text-[11px] font-medium text-[var(--ui-text)]">
					{agent.running ? 'กำลังทำงาน...' : 'เสร็จ��ล้ว'}
				</span>
				{#if agent.running}
					<button
						onclick={() => agent.cancelAgent()}
						class="rounded px-2 py-0.5 text-[10px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
					>ยกเลิก</button>
				{:else}
					<button
						onclick={() => agent.undoAgent()}
						class="rounded px-2 py-0.5 text-[10px] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)]"
					>ย้อนกลับทั้งหมด</button>
				{/if}
			</div>
			<div class="space-y-1.5">
				{#each agent.steps as step}
					<div class="flex items-center gap-2 text-[10px]">
						{#if step.status === 'running'}
							<span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--ui-accent)] border-t-transparent"></span>
						{:else if step.status === 'done'}
							<svg class="h-3 w-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
						{:else if step.status === 'error'}
							<svg class="h-3 w-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
						{:else}
							<span class="inline-block h-3 w-3 rounded-full border border-[var(--ui-border)]"></span>
						{/if}
						<span class="text-[var(--ui-text-secondary)] {step.status === 'error' ? 'text-red-500' : ''}">
							{step.label}
							{#if step.error}
								<span class="text-red-400"> — {step.error}</span>
							{/if}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

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
					{isCollab ? 'แชทร่วมกับทุกคนในห้อง' : agentMode ? 'Agent Mode: บอกว่าอยากได้อะไร แล้ว AI จะสร้างให้' : `ถามอะไรก็ได้เกี่ยวกับ ${diagramTypeLabel}`}
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

		{#each messages as msg, i}
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
					<div class="max-w-[90%]">
						<div class="rounded-2xl rounded-bl-md border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)]">
							<div class="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
						</div>

						<!-- Action preview card -->
						{#if msg.action && msg.action.actions.length > 0}
							<div class="mt-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3">
								<div class="mb-2 flex items-center gap-1.5">
									<svg class="h-3.5 w-3.5 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
									<span class="text-[11px] font-medium text-[var(--ui-text)]">
										{formatActionSummary(msg.action.actions)}
									</span>
								</div>

								<!-- Action list -->
								<div class="mb-2 max-h-32 overflow-y-auto space-y-0.5">
									{#each msg.action.actions.slice(0, 10) as action}
										<div class="text-[10px] text-[var(--ui-text-secondary)] font-mono">
											{formatActionDetail(action)}
										</div>
									{/each}
									{#if msg.action.actions.length > 10}
										<div class="text-[10px] text-[var(--ui-text-muted)] italic">
											+{msg.action.actions.length - 10} รายการเพิ่มเติม
										</div>
									{/if}
								</div>

								<!-- Action buttons or applied badge -->
								{#if msg.action.appliedBy}
									<div class="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
										<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
										นำไปใช้แล้ว โดย {msg.action.appliedBy}
									</div>
								{:else if canApplyAction(msg)}
									<div class="flex gap-2">
										<button
											onclick={() => applyAction(i)}
											class="rounded-lg bg-[var(--ui-accent)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--ui-accent-text)] transition hover:opacity-90"
										>
											นำไปใช้
										</button>
									</div>
								{:else}
									<div class="text-[10px] text-[var(--ui-text-muted)] italic">
										รอ Host นำไปใช้
									</div>
								{/if}
							</div>
						{/if}
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
				placeholder={agentMode ? 'สั่ง AI สร้า��� diagram...' : 'พิมพ์ข้อความ...'}
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
