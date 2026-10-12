<script lang="ts">
	import { parseSqlDdl } from '$lib/utils/sql-parser';
	import { convertToDiagramData } from '$lib/utils/import-adapter';
	import type { ImportedDiagramData } from '$lib/utils/import-adapter';

	let {
		onpreview
	}: {
		onpreview: (data: ImportedDiagramData, warnings: string[]) => void;
	} = $props();

	let dumpText = $state('');
	let fileName = $state('');
	let parsing = $state(false);
	let parseError = $state('');

	
	
	
	const MAX_CHARS = 8_000_000;

	function handleParse() {
		parseError = '';
		const text = dumpText.trim();
		if (!text) {
			parseError = 'กรุณาวาง dump หรืออัปโหลดไฟล์';
			return;
		}
		if (text.length > MAX_CHARS) {
			parseError = 'ไฟล์ใหญ่เกินไป — ลองตัดเอาเฉพาะส่วน schema (CREATE TABLE / ALTER TABLE)';
			return;
		}

		parsing = true;
		try {
			const parsed = parseSqlDdl(text);
			if (parsed.tables.length === 0) {
				parseError = 'ไม่พบตาราง — ตรวจว่า dump มี CREATE TABLE (รองรับ pg_dump / mysqldump)';
				return;
			}
			const data = convertToDiagramData(parsed);
			
			const summary = `พบ ${parsed.tables.length} ตาราง, ${data.relationships.length} ความสัมพันธ์ (ข้อมูลในตาราง/INSERT ถูกข้าม)`;
			onpreview(data, [summary, ...parsed.warnings]);
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
		fileName = file.name;
		parseError = '';
		try {
			dumpText = await file.text();
		} catch {
			parseError = 'อ่านไฟล์ไม่สำเร็จ';
		}
	}
</script>

<div class="flex flex-col gap-3">
	<p class="text-xs text-[var(--ui-text-muted)]">
		วาง output จาก <code class="rounded bg-[var(--ui-bg-tertiary)] px-1">pg_dump</code> หรือ
		<code class="rounded bg-[var(--ui-bg-tertiary)] px-1">mysqldump</code> — จะอ่านเฉพาะ schema
		(CREATE TABLE, PRIMARY KEY, FOREIGN KEY ทั้งแบบ inline และ ALTER TABLE) แล้วสร้าง ER ให้อัตโนมัติ
		ส่วนข้อมูลในตาราง (COPY / INSERT) จะถูกข้าม
	</p>

	<div class="flex items-center gap-2">
		<label class="flex cursor-pointer items-center gap-1.5 rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]">
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
			อัปโหลดไฟล์ dump
			<input type="file" accept=".sql,.dump,.txt" class="hidden" onchange={handleFileUpload} />
		</label>
		{#if fileName}
			<span class="truncate text-[11px] text-[var(--ui-text-muted)]">{fileName}</span>
		{/if}
	</div>

	<textarea
		bind:value={dumpText}
		spellcheck="false"
		placeholder={"วาง dump ที่นี่...\n\nรองรับ pg_dump (public.users, ALTER TABLE ADD CONSTRAINT ...) และ mysqldump (/*!40101 ... */)"}
		class="h-48 w-full resize-none rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 font-mono text-xs text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-muted)] focus:outline-none"
	></textarea>

	{#if parseError}
		<p class="text-xs text-red-500">{parseError}</p>
	{/if}

	<button
		onclick={handleParse}
		disabled={parsing || !dumpText.trim()}
		class="rounded bg-[var(--ui-accent)] px-4 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-40"
	>
		{parsing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ Dump'}
	</button>
</div>
