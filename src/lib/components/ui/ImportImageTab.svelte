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

	let imageFile: File | null = $state(null);
	let imagePreview = $state('');
	let generating = $state(false);
	let errorMsg = $state('');
	let dragging = $state(false);

	function handleFile(file: File) {
		if (!file.type.startsWith('image/')) {
			errorMsg = 'เลือกได้แค่ไฟล์รูปภาพนะ (PNG, JPG, WEBP)';
			return;
		}
		if (file.size > 4 * 1024 * 1024) {
			errorMsg = 'รูปใหญ่เกินไป สูงสุด 4MB';
			return;
		}
		errorMsg = '';
		imageFile = file;
		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.[0]) handleFile(input.files[0]);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0]);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragging = true;
	}

	function onDragLeave() {
		dragging = false;
	}

	function clearImage() {
		imageFile = null;
		imagePreview = '';
		errorMsg = '';
	}

	async function analyze() {
		if (!imageFile) {
			errorMsg = 'เลือกรูปก่อนนะ';
			return;
		}
		generating = true;
		errorMsg = '';

		try {
			const formData = new FormData();
			formData.append('image', imageFile);

			const res = await aiFetch('/api/import', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				const errData: any = await res.json().catch(() => ({ message: 'เกิดข้อผิดพลาดจาก AI' }));
				throw new Error(errData.message || `Error: ${res.status}`);
			}

			const data: AiParsedData = await res.json();
			const converted = convertAiDataToDiagram(data);
			onpreview(converted, []);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์รูปได้';
		} finally {
			generating = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	{#if !aiAvailable}
		<div class="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
			ฟีเจอร์ AI ยังไม่พร้อมใช้งาน กรุณาตั้งค่า GROQ_API_KEY บนเซิร์ฟเวอร์
		</div>
	{/if}

	{#if !imagePreview}
		<!-- Drop zone -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition cursor-pointer
				{dragging ? 'border-[var(--ui-accent)] bg-[var(--ui-accent)]/5' : 'border-[var(--ui-border)] hover:border-[var(--ui-text-muted)]'}"
			ondrop={onDrop}
			ondragover={onDragOver}
			ondragleave={onDragLeave}
			onclick={() => document.getElementById('image-file-input')?.click()}
			onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('image-file-input')?.click(); }}
		>
			<svg class="h-8 w-8 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
			</svg>
			<span class="text-xs text-[var(--ui-text-secondary)]">ลากรูปมาวางตรงนี้ หรือกดเพื่อเลือกไฟล์</span>
			<span class="text-[10px] text-[var(--ui-text-muted)]">PNG, JPG, WEBP (สูงสุด 4MB)</span>
		</div>
		<input
			id="image-file-input"
			type="file"
			accept="image/png,image/jpeg,image/webp"
			class="hidden"
			onchange={onFileInput}
		/>
	{:else}
		<!-- Image preview -->
		<div class="relative rounded-lg border border-[var(--ui-border)] overflow-hidden">
			<img src={imagePreview} alt="Preview" class="w-full max-h-48 object-contain bg-[var(--ui-bg-secondary)]" />
			<button
				onclick={clearImage}
				class="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white transition hover:bg-black/70"
				aria-label="ลบรูป"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
			</button>
		</div>
		<div class="text-[10px] text-[var(--ui-text-muted)]">
			{imageFile?.name} ({imageFile ? (imageFile.size / 1024).toFixed(0) : 0} KB)
		</div>
	{/if}

	{#if errorMsg}
		<p class="text-xs text-red-500">{errorMsg}</p>
	{/if}

	<button
		onclick={analyze}
		disabled={!imageFile || generating || !aiAvailable}
		class="flex items-center justify-center gap-1.5 rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-40"
	>
		{#if generating}
			<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
			กำลังวิเคราะห์รูป...
		{:else}
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
			วิเคราะห์รูป
		{/if}
	</button>
</div>
