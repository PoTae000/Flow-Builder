<script lang="ts">
	import { convertAiDataToDiagram } from '$lib/utils/import-adapter';
	import type { ImportedDiagramData } from '$lib/utils/import-adapter';
	import type { AiParsedData } from '$lib/utils/import-adapter';
	import { aiFetch } from '$lib/utils/ai-fetch';

	let {
		aiAvailable,
		onpreview
	}: {
		aiAvailable: boolean;
		onpreview: (data: ImportedDiagramData, warnings: string[]) => void;
	} = $props();

	let text = $state('');
	let generating = $state(false);
	let errorMsg = $state('');

	async function generate() {
		const desc = text.trim();
		if (!desc) {
			errorMsg = 'กรุณาใส่คำอธิบาย';
			return;
		}
		generating = true;
		errorMsg = '';

		try {
			const res = await aiFetch('/api/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: desc })
			});

			if (!res.ok) {
				const errData: any = await res.json().catch(() => ({ message: 'เกิดข้อผิดพลาดจาก AI' }));
				throw new Error(errData.message || `Error: ${res.status}`);
			}

			const data: AiParsedData = await res.json();
			const converted = convertAiDataToDiagram(data);
			onpreview(converted, []);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'ไม่สามารถสร้าง diagram ได้';
		} finally {
			generating = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	{#if !aiAvailable}
		<div class="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
			ฟีเจอร์ AI ไม่พร้อมใช้งาน กรุณาตั้งค่า GROQ_API_KEY บนเซิร์ฟเวอร์
		</div>
	{/if}

	<textarea
		bind:value={text}
		placeholder="อธิบายฐานข้อมูลที่ต้องการ...&#10;&#10;ตัวอย่าง:&#10;ระบบจองโรงแรม มีห้องพัก มีแขก มีการจอง แขกสามารถจองห้องพักได้หลายครั้ง&#10;&#10;หรือ&#10;&#10;ระบบห้องสมุด มีหนังสือ นักเขียน สมาชิก และประวัติการยืม หนังสือมีได้หลายนักเขียน"
		class="h-40 w-full resize-none rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 text-xs text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-muted)] focus:outline-none"
	></textarea>

	{#if errorMsg}
		<p class="text-xs text-red-500">{errorMsg}</p>
	{/if}

	<button
		onclick={generate}
		disabled={!text.trim() || generating || !aiAvailable}
		class="flex items-center justify-center gap-1.5 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-40"
	>
		{#if generating}
			<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
			กำลังสร้าง...
		{:else}
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
			สร้างด้วย AI
		{/if}
	</button>
</div>
