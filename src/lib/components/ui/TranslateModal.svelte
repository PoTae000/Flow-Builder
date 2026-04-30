<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';

	let {
		onclose
	}: {
		onclose: () => void;
	} = $props();

	type TargetLang = 'th' | 'en';

	interface TranslationMapping {
		entities: Record<string, string>;
		attributes: Record<string, string>;
		relationships: Record<string, string>;
	}

	let targetLang = $state<TargetLang>('th');
	let loading = $state(false);
	let errorMsg = $state('');
	let mapping: TranslationMapping | null = $state(null);
	let applied = $state(false);
	let abortController: AbortController | null = null;

	const loadingMessages = [
		'กำลังแปลให้...',
		'AI กำลังคิดคำแปล...',
		'เกือบเสร็จละ...'
	];
	let loadingMsgIndex = $state(0);
	let loadingTimer: ReturnType<typeof setInterval> | null = null;

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

	// Collect names that have changes
	const entityChanges = $derived.by(() => {
		const m = mapping;
		return m ? Object.entries(m.entities).filter(([k, v]) => k !== v) : [];
	});
	const attributeChanges = $derived.by(() => {
		const m = mapping;
		return m ? Object.entries(m.attributes).filter(([k, v]) => k !== v) : [];
	});
	const relationshipChanges = $derived.by(() => {
		const m = mapping;
		return m ? Object.entries(m.relationships).filter(([k, v]) => k !== v) : [];
	});
	const totalChanges = $derived(entityChanges.length + attributeChanges.length + relationshipChanges.length);

	async function translate(retry = true) {
		loading = true;
		errorMsg = '';
		mapping = null;
		applied = false;
		startLoadingMessages();
		abortController = new AbortController();

		const timeout = setTimeout(() => abortController?.abort(), 30000);

		try {
			const res = await fetch('/api/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entities: $state.snapshot(diagram.entities),
					relationships: $state.snapshot(diagram.relationships),
					targetLang
				}),
				signal: abortController.signal
			});

			if (res.status === 429 && retry) {
				clearTimeout(timeout);
				await new Promise((r) => setTimeout(r, 5000));
				return translate(false);
			}

			if (!res.ok) {
				const errData: any = await res.json().catch(() => ({ message: 'แปลไม่สำเร็จ' }));
				throw new Error(errData.message || `Error: ${res.status}`);
			}

			try {
				mapping = await res.json();
			} catch {
				throw new Error('AI ส่งข้อมูลกลับมาไม่ถูกต้อง ลองใหม่อีกครั้ง');
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				errorMsg = 'ใช้เวลานานเกินไป ลองใหม่อีกครั้ง';
				return;
			}
			errorMsg = err instanceof Error ? err.message : 'ไม่สามารถแปลได้';
		} finally {
			clearTimeout(timeout);
			loading = false;
			abortController = null;
			stopLoadingMessages();
		}
	}

	function applyMapping() {
		if (!mapping) return;
		diagram.applyTranslation(mapping);
		applied = true;
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
			<svg class="h-4 w-4 text-[var(--ui-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">แปลภาษา</h2>
		</div>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-5">
		{#if !mapping && !loading && !errorMsg}
			<!-- Language selector -->
			<div class="mb-4">
				<span class="text-xs text-[var(--ui-text-muted)]">แปลเป็น</span>
				<div class="mt-2 flex gap-2">
					<button
						class="flex-1 rounded-lg border px-3 py-2.5 text-sm transition {targetLang === 'th' ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)]'}"
						onclick={() => targetLang = 'th'}
					>
						🇹🇭 ไทย
					</button>
					<button
						class="flex-1 rounded-lg border px-3 py-2.5 text-sm transition {targetLang === 'en' ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)]'}"
						onclick={() => targetLang = 'en'}
					>
						🇺🇸 English
					</button>
				</div>
			</div>

			<!-- Info -->
			<div class="mb-4 rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3">
				<p class="text-xs leading-relaxed text-[var(--ui-text-secondary)]">
					AI จะแปลชื่อ Entity, Attribute และ Relationship ทั้งหมดเป็น{targetLang === 'th' ? 'ภาษาไทย' : 'ภาษาอังกฤษ'} แสดง preview ให้ดูก่อนยืนยัน
				</p>
			</div>

			<button
				onclick={() => translate()}
				disabled={diagram.entities.length === 0}
				class="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
				แปล
			</button>

			{#if diagram.entities.length === 0}
				<p class="mt-2 text-center text-xs text-[var(--ui-text-muted)]">ยังไม่มี entity ให้แปล</p>
			{/if}

		{:else if loading}
			<div class="flex flex-col items-center justify-center gap-3 py-16">
				<svg class="h-8 w-8 animate-spin text-[var(--ui-text-muted)]" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
				</svg>
				<span class="text-xs text-[var(--ui-text-muted)]">{loadingMessages[loadingMsgIndex]}</span>
				<button
					onclick={() => { abortController?.abort(); loading = false; errorMsg = ''; stopLoadingMessages(); }}
					class="rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				>
					ยกเลิก
				</button>
			</div>

		{:else if errorMsg}
			<div class="flex flex-col items-center gap-3 py-16">
				<svg class="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				<p class="text-xs text-red-500">{errorMsg}</p>
				<button
					onclick={() => { errorMsg = ''; mapping = null; }}
					class="rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>
					กลับ
				</button>
			</div>

		{:else if mapping}
			<!-- Preview -->
			{#if applied}
				<div class="mb-4 flex flex-col items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
					<svg class="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
					<span class="text-xs font-medium text-green-600 dark:text-green-400">แปลเรียบร้อยแล้ว!</span>
					<span class="text-xs text-[var(--ui-text-muted)]">กด Ctrl+Z เพื่อ undo</span>
				</div>
			{/if}

			{#if totalChanges === 0}
				<div class="mb-4 rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3">
					<p class="text-xs text-[var(--ui-text-muted)]">ไม่มีชื่อที่ต้องเปลี่ยน (อาจเป็นภาษาเดิมอยู่แล้ว)</p>
				</div>
			{:else}
				<!-- Entity names -->
				{#if entityChanges.length > 0}
					<div class="mb-4">
						<span class="text-xs font-medium text-[var(--ui-text-muted)]">Entity ({entityChanges.length})</span>
						<div class="mt-2 space-y-1">
							{#each entityChanges as [from, to]}
								<div class="flex items-center gap-2 rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-1.5">
									<span class="text-xs text-[var(--ui-text-secondary)]">{from}</span>
									<svg class="h-3 w-3 shrink-0 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
									<span class="text-xs font-medium text-blue-600 dark:text-blue-400">{to}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Attribute names -->
				{#if attributeChanges.length > 0}
					<div class="mb-4">
						<span class="text-xs font-medium text-[var(--ui-text-muted)]">Attribute ({attributeChanges.length})</span>
						<div class="mt-2 space-y-1">
							{#each attributeChanges as [from, to]}
								<div class="flex items-center gap-2 rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-1.5">
									<span class="text-xs text-[var(--ui-text-secondary)]">{from}</span>
									<svg class="h-3 w-3 shrink-0 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
									<span class="text-xs font-medium text-emerald-600 dark:text-emerald-400">{to}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Relationship names -->
				{#if relationshipChanges.length > 0}
					<div class="mb-4">
						<span class="text-xs font-medium text-[var(--ui-text-muted)]">Relationship ({relationshipChanges.length})</span>
						<div class="mt-2 space-y-1">
							{#each relationshipChanges as [from, to]}
								<div class="flex items-center gap-2 rounded border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-1.5">
									<span class="text-xs text-[var(--ui-text-secondary)]">{from}</span>
									<svg class="h-3 w-3 shrink-0 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
									<span class="text-xs font-medium text-purple-600 dark:text-purple-400">{to}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}

			<!-- Action buttons -->
			<div class="mt-5 flex flex-col gap-2 border-t border-[var(--ui-border)] pt-4">
				{#if !applied && totalChanges > 0}
					<button
						onclick={applyMapping}
						class="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
						ยืนยัน ({totalChanges} รายการ)
					</button>
				{/if}
				<button
					onclick={() => { mapping = null; errorMsg = ''; applied = false; }}
					class="w-full rounded border border-[var(--ui-border)] px-3 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>
					{applied ? 'แปลอีกครั้ง' : 'เลือกภาษาใหม่'}
				</button>
			</div>
		{/if}
	</div>
</div>
