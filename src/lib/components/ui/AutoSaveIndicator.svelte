<script lang="ts">
	import { autoSave } from '$lib/stores/auto-save.svelte';
	import { pickSaveLocation } from '$lib/utils/file-system';

	async function handlePickLocation() {
		const handle = await pickSaveLocation();
		if (handle) {
			autoSave.setFileHandle(handle);
		}
	}

	async function handleSaveNow() {
		await autoSave.saveNow();
	}

	const statusColor = $derived(() => {
		if (autoSave.status === 'saving') return 'text-blue-500 bg-blue-50 dark:bg-blue-950/30';
		if (autoSave.status === 'saved') return 'text-green-600 bg-green-50 dark:bg-green-950/30';
		if (autoSave.status === 'error') return 'text-red-500 bg-red-50 dark:bg-red-950/30';
		return 'text-[var(--ui-text-muted)]';
	});

	const buttonText = $derived(() => {
		if (autoSave.status === 'saving') return 'กำลังบันทึก...';
		if (autoSave.status === 'saved') return 'บันทึกแล้ว';
		if (autoSave.status === 'error') return 'ผิดพลาด';
		return 'Save';
	});

	const icon = $derived(() => {
		if (autoSave.status === 'saving') {
			return `<svg class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>`;
		}
		if (autoSave.status === 'saved') {
			return `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
		}
		if (autoSave.status === 'error') {
			return `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
		}
		return `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>`;
	});
</script>

{#if autoSave.isSupported}
	<div class="flex items-center gap-2 text-xs">
		{#if !autoSave.fileHandle}
			<button
				onclick={handlePickLocation}
				class="flex items-center gap-1.5 rounded px-2 py-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				title="เลือกที่บันทึกไฟล์อัตโนมัติ"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<span class="hidden sm:inline">เลือกที่บันทึก</span>
			</button>
		{:else}
			<button
				onclick={handleSaveNow}
				class="flex items-center gap-1.5 rounded px-2 py-1 text-xs transition hover:opacity-80 {statusColor()}"
				title="คลิกเพื่อบันทึกทันที"
			>
				{@html icon()}
				<span class="font-medium">{buttonText()}</span>
			</button>

			<button
				onclick={() => autoSave.toggle()}
				class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				title={autoSave.enabled ? 'ปิด Auto-Save' : 'เปิด Auto-Save'}
			>
				{#if autoSave.enabled}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				{:else}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				{/if}
			</button>

			<button
				onclick={() => autoSave.clear()}
				class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-red-500"
				title="ยกเลิกการบันทึกอัตโนมัติ"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>
{/if}
