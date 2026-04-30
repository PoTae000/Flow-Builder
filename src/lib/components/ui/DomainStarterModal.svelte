<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { convertAiDataToDiagram } from '$lib/utils/import-adapter';
	import type { AiParsedData } from '$lib/utils/import-adapter';
	import type { ImportedDiagramData } from '$lib/utils/import-adapter';

	let { onclose }: { onclose: () => void } = $props();

	let domain = $state('');
	let generating = $state(false);
	let errorMsg = $state('');
	let aiAvailable = $state<boolean | null>(null);
	let preview = $state<ImportedDiagramData | null>(null);

	const suggestions = [
		'E-Commerce',
		'ร้านอาหาร',
		'โรงพยาบาล',
		'โรงเรียน',
		'ธนาคาร',
		'โรงแรม',
		'ห้องสมุด',
		'Social Media',
		'บุคลากร',
		'สายการบิน'
	];

	// Check AI availability
	async function checkAi() {
		try {
			const res = await fetch('/api/import/check');
			const data: any = await res.json();
			aiAvailable = data.available;
		} catch {
			aiAvailable = false;
		}
	}
	checkAi();

	function selectSuggestion(s: string) {
		domain = s;
	}

	async function generate() {
		const d = domain.trim();
		if (!d) {
			errorMsg = 'กรุณาพิมพ์ชื่อโดเมน';
			return;
		}
		generating = true;
		errorMsg = '';
		preview = null;

		try {
			const res = await fetch('/api/domain-starter', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain: d })
			});

			if (!res.ok) {
				const errData: any = await res.json().catch(() => ({ message: 'เกิดข้อผิดพลาดจาก AI' }));
				throw new Error(errData.message || `Error: ${res.status}`);
			}

			const data: AiParsedData = await res.json();
			preview = convertAiDataToDiagram(data);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'ไม่สามารถสร้าง ER Diagram ได้';
		} finally {
			generating = false;
		}
	}

	async function applyDiagram() {
		if (!preview) return;

		if (diagram.entities.length > 0) {
			const confirmed = await dialog.confirm({
				title: 'แทนที่ Diagram',
				message: 'ข้อมูลปัจจุบันจะถูกแทนที่ ต้องการดำเนินการต่อหรือไม่?',
				confirmText: 'แทนที่',
				cancelText: 'ยกเลิก',
				variant: 'info'
			});
			if (!confirmed) return;
		}

		diagram.pushHistory('Domain Starter');
		diagram.entities = JSON.parse(JSON.stringify(preview.entities));
		diagram.relationships = JSON.parse(JSON.stringify(preview.relationships));
		diagram.autoLayout();
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-black/50 animate-fade-in"
	onclick={onclose}
	onkeydown={handleKeydown}
></div>

<!-- Modal -->
<div class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl animate-scale-in max-sm:landscape:max-h-[calc(100vh-1rem)]">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<h2 class="flex items-center gap-1.5 text-sm font-normal text-[var(--ui-text)]">
			<svg class="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
			AI Domain Starter
		</h2>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	<!-- Content -->
	<div class="flex flex-col gap-4 p-5">
		{#if aiAvailable === false}
			<div class="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
				ฟีเจอร์ AI ไม่พร้อมใช้งาน กรุณาตั้งค่า GROQ_API_KEY บนเซิร์ฟเวอร์
			</div>
		{/if}

		<!-- Domain input -->
		<div class="flex flex-col gap-2">
			<span class="text-xs font-medium text-[var(--ui-text-secondary)]">พิมพ์ชื่อโดเมน / ธุรกิจ</span>
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={domain}
					placeholder="เช่น e-commerce, ระบบร้านอาหาร..."
					class="flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-xs text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-muted)] focus:outline-none"
					onkeydown={(e) => { if (e.key === 'Enter' && domain.trim()) generate(); }}
				/>
				<button
					onclick={generate}
					disabled={!domain.trim() || generating || aiAvailable === false}
					class="flex items-center gap-1.5 rounded bg-purple-600 px-4 py-2 text-xs font-light text-white transition hover:bg-purple-700 disabled:opacity-40"
				>
					{#if generating}
						<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
						กำลังสร้าง...
					{:else}
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
						สร้าง
					{/if}
				</button>
			</div>
		</div>

		<!-- Suggestion chips -->
		<div class="flex flex-col gap-1.5">
			<span class="text-[10px] text-[var(--ui-text-muted)]">หรือเลือกจากตัวอย่าง:</span>
			<div class="flex flex-wrap gap-1.5">
				{#each suggestions as s}
					<button
						class="rounded-full border border-[var(--ui-border)] px-2.5 py-1 text-[11px] text-[var(--ui-text-secondary)] transition hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 {domain === s ? 'border-purple-400 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' : ''}"
						onclick={() => selectSuggestion(s)}
					>
						{s}
					</button>
				{/each}
			</div>
		</div>

		{#if errorMsg}
			<p class="text-xs text-red-500">{errorMsg}</p>
		{/if}

		<!-- Preview -->
		{#if preview}
			<div class="flex flex-col gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-4">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-[var(--ui-text)]">ผลลัพธ์</span>
					<div class="flex items-center gap-3 text-[10px] text-[var(--ui-text-muted)]">
						<span>{preview.entities.length} เอนทิตี</span>
						<span>{preview.relationships.length} ความสัมพันธ์</span>
					</div>
				</div>

				<!-- Entity list -->
				<div class="flex flex-col gap-2 max-h-52 overflow-y-auto">
					{#each preview.entities as entity}
						<div class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2">
							<div class="flex items-center gap-1.5">
								<span class="text-xs font-medium text-[var(--ui-text)]">{entity.name}</span>
								{#if entity.isWeak}
									<span class="rounded bg-yellow-100 dark:bg-yellow-900/30 px-1 text-[9px] text-yellow-600 dark:text-yellow-400">weak</span>
								{/if}
							</div>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each entity.attributes as attr}
									<span class="rounded bg-[var(--ui-bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--ui-text-muted)] {attr.type === 'primary_key' ? '!text-blue-500 font-medium' : ''} {attr.type === 'foreign_key' ? '!text-green-500' : ''}">
										{attr.type === 'primary_key' ? 'PK ' : ''}{attr.type === 'foreign_key' ? 'FK ' : ''}{attr.name}
									</span>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<!-- Apply button -->
				<button
					onclick={applyDiagram}
					class="flex items-center justify-center gap-1.5 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
					ใช้งาน Diagram นี้
				</button>
			</div>
		{/if}
	</div>
</div>
