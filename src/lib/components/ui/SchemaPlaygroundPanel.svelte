<script lang="ts">
	import { dockPanel } from '$lib/utils/dock-transition';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { erToSqlite, generateSampleData } from '$lib/utils/er-to-sqlite';

	let { onclose }: { onclose: () => void } = $props();

	
	let SQL: any = null;
	let db: any = null;

	let loading = $state(true);
	let initError = $state('');
	let schemaWarnings = $state<string[]>([]);
	let ddlText = $state('');
	let includeSampleData = $state(true);

	let sql = $state('');
	let queryError = $state('');
	let columns = $state<string[]>([]);
	let rows = $state<any[][]>([]);
	let rowCount = $state(0);
	let lastAction = $state('');
	let tableNames = $state<string[]>([]);

	async function initDb() {
		loading = true;
		initError = '';
		try {
			
			const initSqlJs = (await import('sql.js/dist/sql-wasm.js')).default;
			SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
			rebuild();
		} catch (err) {
			initError = err instanceof Error ? err.message : 'โหลด SQLite engine ไม่สำเร็จ';
		} finally {
			loading = false;
		}
	}

	function rebuild() {
		if (!SQL) return;
		queryError = '';
		columns = [];
		rows = [];
		rowCount = 0;
		lastAction = '';

		if (db) {
			try { db.close(); } catch { /* ignore */ }
			db = null;
		}

		const entities = $state.snapshot(diagram.entities);
		const relationships = $state.snapshot(diagram.relationships);

		if (entities.length === 0) {
			initError = 'ยังไม่มี Entity ใน diagram — เพิ่ม Entity ก่อนแล้วลองใหม่';
			return;
		}
		initError = '';

		const gen = erToSqlite(entities, relationships);
		schemaWarnings = gen.warnings;
		tableNames = [...gen.columnsByTable.keys()];

		let fullDdl = gen.ddl;
		if (includeSampleData) {
			const data = generateSampleData(entities, gen.columnsByTable, gen.pkByTable);
			if (data.trim()) fullDdl += '\n' + data;
		}
		ddlText = fullDdl;

		try {
			db = new SQL.Database();
			db.run(fullDdl);
			if (!sql.trim() && tableNames.length > 0) {
				sql = `SELECT * FROM ${quoteName(tableNames[0])};`;
			}
		} catch (err) {
			initError = 'สร้าง schema ไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err));
		}
	}

	function quoteName(name: string): string {
		return '"' + name.replace(/"/g, '""') + '"';
	}

	function runQuery() {
		if (!db || !sql.trim()) return;
		queryError = '';
		columns = [];
		rows = [];
		rowCount = 0;
		lastAction = '';
		try {
			const trimmed = sql.trim();
			const isSelect = /^\s*(select|with|pragma|explain)/i.test(trimmed);
			if (isSelect) {
				const res = db.exec(trimmed);
				if (res.length === 0) {
					lastAction = 'คำสั่งทำงานสำเร็จ — ไม่มีผลลัพธ์';
				} else {
					
					const last = res[res.length - 1];
					columns = last.columns;
					rows = last.values;
					rowCount = rows.length;
				}
			} else {
				db.run(trimmed);
				const changes = db.getRowsModified();
				lastAction = `คำสั่งทำงานสำเร็จ — แก้ไข ${changes} แถว`;
			}
		} catch (err) {
			queryError = err instanceof Error ? err.message : String(err);
		}
	}

	function insertTemplate(name: string) {
		sql = `SELECT * FROM ${quoteName(name)};`;
		runQuery();
	}

	async function copyDdl() {
		await navigator.clipboard.writeText(ddlText);
		toast.success('คัดลอก schema แล้ว');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function onSqlKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			runQuery();
		}
	}

	$effect(() => {
		initDb();
		return () => {
			if (db) { try { db.close(); } catch { /* ignore */ } }
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />


<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 bg-black/30 animate-fade-in" data-panel-backdrop onclick={onclose}></div>


<div class="fixed right-0 top-0 z-50 flex h-full w-full md:w-[560px] md:max-w-[95vw] flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl panel-slide-in" data-workspace-panel transition:dockPanel|global>
	
	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">Live Schema Playground</h2>
		</div>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>

	
	<div class="flex-1 overflow-y-auto p-5">
		{#if loading}
			<div class="flex flex-col items-center gap-3 py-10">
				<svg class="h-6 w-6 animate-spin text-[var(--ui-accent)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
				<span class="text-xs text-[var(--ui-text-muted)]">กำลังโหลด SQLite engine...</span>
			</div>
		{:else if initError}
			<div class="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
				{initError}
			</div>
			<button
				onclick={rebuild}
				class="mt-3 rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
			>
				ลองสร้าง schema ใหม่
			</button>
		{:else}
			
			<div class="mb-3 flex flex-wrap items-center gap-2">
				<span class="text-[11px] text-[var(--ui-text-muted)]">
					{tableNames.length} ตาราง จาก ER diagram
				</span>
				<label class="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--ui-text-secondary)]">
					<input
						type="checkbox"
						bind:checked={includeSampleData}
						onchange={rebuild}
						class="h-3.5 w-3.5 accent-[var(--ui-accent)]"
					/>
					ใส่ข้อมูลตัวอย่าง
				</label>
				<button
					onclick={copyDdl}
					class="rounded border border-[var(--ui-border)] px-2 py-1 text-[11px] text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>
					คัดลอก schema
				</button>
			</div>

			
			{#if tableNames.length > 0}
				<div class="mb-3 flex flex-wrap gap-1.5">
					{#each tableNames as t}
						<button
							onclick={() => insertTemplate(t)}
							class="rounded-full border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--ui-text-secondary)] transition hover:border-[var(--ui-accent)] hover:text-[var(--ui-text)]"
						>
							{t}
						</button>
					{/each}
				</div>
			{/if}

			
			{#if schemaWarnings.length > 0}
				<div class="mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-400">
					{#each schemaWarnings as w}
						<div>• {w}</div>
					{/each}
				</div>
			{/if}

			
			<textarea
				bind:value={sql}
				placeholder={"SELECT * FROM ...\n-- Ctrl+Enter เพื่อรัน"}
				class="w-full h-28 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)] resize-y"
				style="font-family: 'Fira Code', 'Cascadia Code', monospace;"
				onkeydown={onSqlKeydown}
			></textarea>

			<div class="mt-2 flex gap-2">
				<button
					onclick={runQuery}
					disabled={!sql.trim()}
					class="flex-1 rounded bg-[var(--ui-accent)] px-3 py-2 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-50"
				>
					รัน Query (Ctrl+Enter)
				</button>
				<button
					onclick={rebuild}
					title="รีเซ็ตฐานข้อมูลกลับเป็น schema ตั้งต้น"
					class="rounded border border-[var(--ui-border)] px-3 py-2 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>
					รีเซ็ต DB
				</button>
			</div>

			
			{#if queryError}
				<div class="mt-3 rounded border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-500" style="font-family: 'Fira Code', monospace;">
					{queryError}
				</div>
			{/if}

			
			{#if lastAction}
				<div class="mt-3 rounded border border-green-500/30 bg-green-500/10 p-2.5 text-xs text-green-600 dark:text-green-400">
					{lastAction}
				</div>
			{/if}

			
			{#if columns.length > 0}
				<div class="mt-3 text-[11px] text-[var(--ui-text-muted)]">{rowCount} แถว</div>
				<div class="mt-1 overflow-x-auto rounded-lg border border-[var(--ui-border)]">
					<table class="w-full border-collapse text-xs">
						<thead>
							<tr class="bg-[var(--ui-bg-secondary)]">
								{#each columns as col}
									<th class="border-b border-[var(--ui-border)] px-3 py-1.5 text-left font-medium text-[var(--ui-text)] whitespace-nowrap">{col}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each rows as row}
								<tr class="odd:bg-[var(--ui-bg)] even:bg-[var(--ui-bg-secondary)]/40">
									{#each row as cell}
										<td class="border-b border-[var(--ui-border)] px-3 py-1.5 text-[var(--ui-text-secondary)] whitespace-nowrap">
											{cell === null ? 'NULL' : cell}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</div>
</div>
