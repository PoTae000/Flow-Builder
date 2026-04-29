<script lang="ts">
	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	interface AnalysisIssue {
		severity: 'error' | 'warning' | 'info';
		title: string;
		description: string;
		reason: string;
		fix: string;
	}

	interface AnalysisResult {
		score: number;
		summary: string;
		issues: AnalysisIssue[];
		suggestions: string[];
	}

	let result: AnalysisResult | null = $state(null);
	let loading = $state(true);
	let errorMsg = $state('');
	let expandedIssue = $state<number | null>(null);
	let fixing = $state(false);
	let cancelled = $state(false);
	let abortController: AbortController | null = null;
	let loadingMsgIndex = $state(0);
	let loadingTimer: ReturnType<typeof setInterval> | null = null;

	const loadingMessages = [
		'รอแป๊บนะ กำลังดูให้...',
		'กำลังวิเคราะห์อยู่...',
		'เช็ค entity กับ relationship...',
		'ดู normalization...',
		'เกือบเสร็จละ...'
	];

	function startLoadingMessages() {
		loadingMsgIndex = 0;
		loadingTimer = setInterval(() => {
			if (loadingMsgIndex < loadingMessages.length - 1) {
				loadingMsgIndex++;
			}
		}, 3000);
	}

	function stopLoadingMessages() {
		if (loadingTimer) {
			clearInterval(loadingTimer);
			loadingTimer = null;
		}
	}

	import { diagram } from '$lib/stores/diagram.svelte';
	import { convertAiDataToDiagram, type AiParsedData } from '$lib/utils/import-adapter';

	function cancelRequest() {
		cancelled = true;
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
		loading = false;
		fixing = false;
		result = null;
		errorMsg = '';
		stopLoadingMessages();
	}

	async function analyze(retry = true) {
		loading = true;
		errorMsg = '';
		result = null;
		cancelled = false;
		startLoadingMessages();
		abortController = new AbortController();

		const timeout = setTimeout(() => abortController?.abort(), 30000);

		try {
			const res = await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entities: $state.snapshot(diagram.entities),
					relationships: $state.snapshot(diagram.relationships)
				}),
				signal: abortController.signal
			});

			if (res.status === 429 && retry) {
				clearTimeout(timeout);
				await new Promise((r) => setTimeout(r, 5000));
				if (!cancelled) return analyze(false);
				return;
			}

			if (!res.ok) {
				const errData = await res.json().catch(() => ({ message: 'วิเคราะห์ไม่สำเร็จ' }));
				throw new Error(errData.message || `Error: ${res.status}`);
			}

			try {
				result = await res.json();
			} catch {
				throw new Error('AI ส่งข้อมูลกลับมาไม่ถูกต้อง ลองใหม่อีกครั้ง');
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				if (!cancelled) errorMsg = 'ใช้เวลานานเกินไป ลองใหม่อีกครั้ง';
				return;
			}
			errorMsg = err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์ diagram ได้';
		} finally {
			clearTimeout(timeout);
			loading = false;
			abortController = null;
			stopLoadingMessages();
		}
	}

	async function autoFix(retry = true) {
		if (!result || fixing) return;
		fixing = true;
		errorMsg = '';
		abortController = new AbortController();

		const timeout = setTimeout(() => abortController?.abort(), 30000);

		try {
			const res = await fetch('/api/fix', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entities: $state.snapshot(diagram.entities),
					relationships: $state.snapshot(diagram.relationships),
					issues: result.issues
				}),
				signal: abortController.signal
			});

			if (res.status === 429 && retry) {
				clearTimeout(timeout);
				await new Promise((r) => setTimeout(r, 5000));
				if (!cancelled) { fixing = false; return autoFix(false); }
				return;
			}

			if (!res.ok) {
				const errData = await res.json().catch(() => ({ message: 'แก้ไม่สำเร็จ' }));
				throw new Error(errData.message || `Error: ${res.status}`);
			}

			let aiData: AiParsedData;
			try {
				aiData = await res.json();
			} catch {
				throw new Error('AI ส่งข้อมูลกลับมาไม่ถูกต้อง ลองใหม่อีกครั้ง');
			}
			const converted = convertAiDataToDiagram(aiData);

			diagram.pushHistory();
			diagram.entities = converted.entities;
			diagram.relationships = converted.relationships;
			diagram.autoLayout();

			// Re-analyze to show new result
			await analyze();
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				if (!cancelled) errorMsg = 'ใช้เวลานานเกินไป ลองใหม่อีกครั้ง';
				return;
			}
			errorMsg = err instanceof Error ? err.message : 'ไม่สามารถแก้ไข diagram ได้';
		} finally {
			clearTimeout(timeout);
			fixing = false;
			abortController = null;
		}
	}

	// Start analysis on mount
	analyze();

	interface Grade {
		label: string;
		color: string;
		bg: string;
	}

	const grade = $derived.by((): Grade => {
		const r = result;
		if (!r) return { label: '...', color: 'text-[var(--ui-text-muted)]', bg: 'bg-[var(--ui-bg-tertiary)]' };
		if (r.score >= 90) return { label: 'ดีมาก', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/30' };
		if (r.score >= 70) return { label: 'ดี', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' };
		if (r.score >= 50) return { label: 'พอใช้', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30' };
		return { label: 'ต้องปรับปรุง', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' };
	});

	const severityStyles: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
		error: {
			bg: 'bg-red-500/10',
			border: 'border-red-500/20',
			text: 'text-red-600 dark:text-red-400',
			icon: 'bg-red-500/20',
			label: 'ต้องแก้'
		},
		warning: {
			bg: 'bg-yellow-500/10',
			border: 'border-yellow-500/20',
			text: 'text-yellow-600 dark:text-yellow-400',
			icon: 'bg-yellow-500/20',
			label: 'ควรดู'
		},
		info: {
			bg: 'bg-blue-500/10',
			border: 'border-blue-500/20',
			text: 'text-blue-600 dark:text-blue-400',
			icon: 'bg-blue-500/20',
			label: 'แนะนำ'
		}
	};

	function toggleIssue(index: number) {
		expandedIssue = expandedIssue === index ? null : index;
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/30 animate-fade-in"
	onclick={onclose}
	onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
></div>

<!-- Slide-over panel -->
<div class="fixed right-0 top-0 z-50 flex h-full w-full md:w-[420px] md:max-w-[90vw] flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl panel-slide-in">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">วิเคราะห์</h2>
		</div>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-5">
		{#if loading || fixing}
			<div class="flex flex-col items-center justify-center gap-3 py-16">
				<svg class="h-8 w-8 animate-spin text-[var(--ui-text-muted)]" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
				</svg>
				<span class="text-xs text-[var(--ui-text-muted)]">{fixing ? 'AI กำลังแก้ให้...' : loadingMessages[loadingMsgIndex]}</span>
				<button
					onclick={cancelRequest}
					class="rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				>
					ยกเลิก
				</button>
			</div>
		{:else if cancelled}
			<div class="flex flex-col items-center gap-3 py-16">
				<span class="text-xs text-[var(--ui-text-muted)]">ยกเลิกแล้ว</span>
				<button
					onclick={() => analyze()}
					class="rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>
					วิเคราะห์ใหม่
				</button>
			</div>
		{:else if errorMsg}
			<div class="flex flex-col items-center gap-3 py-16">
				<svg class="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				<p class="text-xs text-red-500">{errorMsg}</p>
				<button
					onclick={() => analyze()}
					class="rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>
					ลองใหม่
				</button>
			</div>
		{:else if result}
			<!-- Grade -->
			<div class="mb-5 flex flex-col items-center gap-1 rounded-lg border {grade.bg} p-4">
				<div class="text-2xl font-medium {grade.color}">{grade.label}</div>
			</div>

			<!-- Summary -->
			<div class="mb-5 rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3">
				<span class="text-xs text-[var(--ui-text-muted)]">สรุปรวม</span>
				<p class="mt-1 text-xs leading-relaxed text-[var(--ui-text)]">{result.summary}</p>
			</div>

			{#if result.score < 70}
				<!-- Issues -->
				{#if result.issues.length > 0}
					<div class="mb-5">
						<span class="text-xs font-medium text-[var(--ui-text-muted)]">
							จุดที่มีปัญหา ({result.issues.length})
						</span>
						<div class="mt-2 flex flex-col gap-2">
							{#each result.issues as issue, i}
								{@const style = severityStyles[issue.severity] || severityStyles.info}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="overflow-hidden rounded-lg border {style.border} {style.bg} cursor-pointer transition hover:opacity-90"
									onclick={() => toggleIssue(i)}
									onkeydown={(e) => { if (e.key === 'Enter') toggleIssue(i); }}
								>
									<div class="flex items-start gap-2.5 p-3">
										<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold {style.text} {style.icon}">
											{issue.severity === 'error' ? '!' : issue.severity === 'warning' ? '?' : 'i'}
										</span>
										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap items-center gap-1.5">
												<span class="text-xs font-medium {style.text}">{issue.title}</span>
												<span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] {style.text} {style.bg}">
													{style.label}
												</span>
											</div>
											<p class="mt-1 text-xs leading-relaxed text-[var(--ui-text-secondary)]">{issue.description}</p>
										</div>
										<svg class="h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)] transition {expandedIssue === i ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
									</div>

									{#if expandedIssue === i}
										<div class="border-t border-[var(--ui-border-light)] px-3 pb-3 pt-2 space-y-2">
											<div>
												<span class="text-[10px] font-medium uppercase tracking-wider text-[var(--ui-text-muted)]">ทำไมถึงผิด?</span>
												<p class="mt-0.5 text-xs leading-relaxed text-[var(--ui-text-secondary)]">{issue.reason}</p>
											</div>
											<div>
												<span class="text-[10px] font-medium uppercase tracking-wider text-green-600 dark:text-green-400">แก้ยังไง?</span>
												<p class="mt-0.5 text-xs leading-relaxed text-[var(--ui-text)]">{issue.fix}</p>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Suggestions -->
				{#if result.suggestions.length > 0}
					<div>
						<span class="text-xs font-medium text-[var(--ui-text-muted)]">คำแนะนำ</span>
						<ul class="mt-2 space-y-1.5">
							{#each result.suggestions as suggestion}
								<li class="flex items-start gap-2 text-xs text-[var(--ui-text-secondary)]">
									<svg class="mt-0.5 h-3 w-3 shrink-0 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
									{suggestion}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/if}

			<!-- Action buttons -->
			<div class="mt-5 flex flex-col gap-2 border-t border-[var(--ui-border)] pt-4">
				{#if result.score < 70 && result.issues.length > 0}
					<button
						onclick={() => autoFix()}
						disabled={fixing || loading}
						class="flex w-full items-center justify-center gap-2 rounded bg-green-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if fixing}
							<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
							</svg>
							AI กำลังแก้ให้...
						{:else}
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
							AI แก้ให้
						{/if}
					</button>
				{/if}
				<button
					onclick={() => analyze()}
					disabled={fixing || loading}
					class="w-full rounded border border-[var(--ui-border)] px-3 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
				>
					วิเคราะห์อีกรอบ
				</button>
			</div>
		{/if}
	</div>
</div>
