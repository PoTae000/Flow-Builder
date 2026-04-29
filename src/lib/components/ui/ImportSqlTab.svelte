<script lang="ts">
	import { parseSqlDdl } from '$lib/utils/sql-parser';
	import { convertToDiagramData } from '$lib/utils/import-adapter';
	import type { ImportedDiagramData } from '$lib/utils/import-adapter';

	let {
		onpreview
	}: {
		onpreview: (data: ImportedDiagramData, warnings: string[]) => void;
	} = $props();

	let sqlText = $state('');
	let parsing = $state(false);
	let parseError = $state('');

	function handleParse() {
		parseError = '';
		const text = sqlText.trim();
		if (!text) {
			parseError = 'กรุณาใส่คำสั่ง SQL DDL';
			return;
		}

		parsing = true;
		try {
			const parsed = parseSqlDdl(text);
			if (parsed.tables.length === 0) {
				parseError = 'ไม่พบตาราง ตรวจสอบว่า SQL มีคำสั่ง CREATE TABLE';
				return;
			}
			const data = convertToDiagramData(parsed);
			onpreview(data, parsed.warnings);
		} catch (err) {
			parseError = `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'}`;
		} finally {
			parsing = false;
		}
	}

	async function handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const text = await file.text();
		sqlText = text;
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2">
		<label class="flex cursor-pointer items-center gap-1.5 rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]">
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
			อัปโหลดไฟล์ .sql
			<input type="file" accept=".sql,.txt" class="hidden" onchange={handleFileUpload} />
		</label>
	</div>

	<textarea
		bind:value={sqlText}
		placeholder="วาง CREATE TABLE ที่นี่...&#10;&#10;ตัวอย่าง:&#10;CREATE TABLE users (&#10;  id INT PRIMARY KEY,&#10;  name VARCHAR(100),&#10;  email VARCHAR(255)&#10;);"
		class="h-48 w-full resize-none rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 font-mono text-xs text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-muted)] focus:outline-none"
	></textarea>

	{#if parseError}
		<p class="text-xs text-red-500">{parseError}</p>
	{/if}

	<button
		onclick={handleParse}
		disabled={parsing || !sqlText.trim()}
		class="rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-40"
	>
		{parsing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ SQL'}
	</button>
</div>
