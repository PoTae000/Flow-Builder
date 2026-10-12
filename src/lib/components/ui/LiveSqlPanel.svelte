<script lang="ts">
	import { dockPanel } from '$lib/utils/dock-transition';
 import { shortcutCode } from '$lib/utils/keyboard';
 import { diagram } from '$lib/stores/diagram.svelte';
 import { collab } from '$lib/stores/collab.svelte';
 import { session } from '$lib/stores/session.svelte';
 import { toast } from '$lib/stores/toast.svelte';
 import { generateErSql } from '$lib/utils/er-to-sql';
 import { reconcileLiveSql } from '$lib/utils/live-sql';
 let { onclose }: { onclose: () => void } = $props();
 let sqlText = $state('');
 let syncError = $state('');
 let dirty = $state(false);
 let applying = $state(false);
 let externalChanges = $state(false);
 let baselineSql = $state('');
 let loadedContext = $state('');
 let draftUndo = $state<string[]>([]);
 let draftRedo = $state<string[]>([]);
 let revision = 0, pending = false, disposed = false;
 let applyTimer: ReturnType<typeof setTimeout> | undefined;
 const context = $derived(`${session.activeDiagramId}:${diagram.diagramType}`);
 const generated = $derived.by(() => generateErSql(diagram.entities, diagram.relationships));
 const genWarnings = $derived(generated.warnings);
 const readOnly = $derived(diagram.viewOnly || collab.isViewer || diagram.diagramType !== 'er');
 $effect(() => {
  if (loadedContext !== context) {
   if (applyTimer) clearTimeout(applyTimer);
   revision++;
   loadedContext = context;
   draftUndo = []; draftRedo = [];
   sqlText = generated.sql;
   baselineSql = generated.sql;
   dirty = false;
   externalChanges = false;
   syncError = '';
  } else if (!applying && generated.sql !== baselineSql) {
   if (dirty) externalChanges = true;
   else { sqlText = generated.sql; baselineSql = generated.sql; externalChanges = false; }
  }
 });
 function handleInput(e: Event) {
  const next = (e.currentTarget as HTMLTextAreaElement).value;
  if (next !== sqlText) { draftUndo = [...draftUndo.slice(-99), sqlText]; draftRedo = []; }
  sqlText = next;
  revision++;
  dirty = sqlText !== baselineSql;
  syncError = '';
  if (applyTimer) clearTimeout(applyTimer);
  applyTimer = setTimeout(() => { void applySqlToDiagram(); }, 600);
 }
 async function applySqlToDiagram() {
  if (readOnly || !dirty || disposed) return;
  if (applying) { pending = true; return; }
  const text = sqlText, version = revision, requestContext = context;
  if (generated.sql !== baselineSql) {
   externalChanges = true;
   syncError = 'Diagram เปลี่ยนระหว่างแก้ SQL — โหลด SQL จาก diagram ก่อนเพื่อไม่ทับงานใหม่';
   return;
  }
  try { reconcileLiveSql(text, diagram.entities, diagram.relationships); }
  catch (err) { syncError = err instanceof Error ? err.message : 'SQL ไม่ถูกต้อง'; return; }
  applying = true;
  try {
   const operation = async () => {
    if (disposed || requestContext !== context || version !== revision) return;
    if (generated.sql !== baselineSql) throw new Error('Diagram เปลี่ยนระหว่างรอ กรุณาโหลด SQL จาก diagram ใหม่');
    const data = reconcileLiveSql(text, diagram.entities, diagram.relationships);
    const applied = await diagram.replaceContent(data, 'แก้ไขผ่าน SQL');
    if (!applied) throw new Error('ชิ้นงานกำลังถูกแก้โดยผู้อื่น — SQL ของคุณยังเก็บไว้');
    if (disposed || requestContext !== context) return;
    baselineSql = generateErSql(diagram.entities, diagram.relationships).sql;
    if (version === revision) { dirty = false; draftUndo = []; }
    externalChanges = false;
    syncError = '';
   };
   if (collab.connected) {
    if (!await collab.runLocked(diagram.editableItemIds, operation)) syncError = 'ไม่สามารถล็อกชิ้นงานได้ — SQL ของคุณยังเก็บไว้';
   } else await operation();
  } catch (err) { syncError = err instanceof Error ? err.message : 'ซิงก์ไม่สำเร็จ'; }
  finally {
   applying = false;
   if (!disposed && (pending || version !== revision)) { pending = false; void applySqlToDiagram(); }
  }
 }
 function forceSync() {
  if (applyTimer) clearTimeout(applyTimer);
  void applySqlToDiagram();
 }
 function refreshSqlFromDiagram() {
  if (applyTimer) clearTimeout(applyTimer);
  revision++;
  sqlText = generated.sql;
  draftUndo = []; draftRedo = [];
  baselineSql = generated.sql;
  dirty = false;
  externalChanges = false;
  syncError = '';
 }
 async function historyAction(redoAction: boolean) {
  if (readOnly || applying) return;
  if (applyTimer) clearTimeout(applyTimer);
  const stack = redoAction ? draftRedo : draftUndo;
  if (stack.length) {
   const target = stack[stack.length - 1];
   if (redoAction) { draftRedo = draftRedo.slice(0, -1); draftUndo = [...draftUndo, sqlText]; }
   else { draftUndo = draftUndo.slice(0, -1); draftRedo = [...draftRedo, sqlText]; }
   revision++;
   sqlText = target;
   dirty = sqlText !== baselineSql;
   syncError = '';
   if (dirty) applyTimer = setTimeout(() => { void applySqlToDiagram(); }, 600);
   return;
  }
  const operation = async () => { redoAction ? diagram.redo() : diagram.undo(); await diagram.waitForEdits(); refreshSqlFromDiagram(); };
  if (collab.connected) await collab.runLocked(diagram.editableItemIds, operation);
  else await operation();
 }
 function undo() { void historyAction(false); }
 function redo() { void historyAction(true); }
 async function copySql() {
  try { await navigator.clipboard.writeText(sqlText); toast.success('คัดลอก SQL แล้ว'); }
  catch { toast.error('คัดลอกไม่สำเร็จ'); }
 }
 function handleEditorKeydown(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey)) return;
  const code = shortcutCode(e);
  const undoKey = code === 'KeyZ';
  const redoKey = code === 'KeyY';
  if (undoKey || redoKey) {
   e.preventDefault(); e.stopPropagation();
   void historyAction(redoKey || e.shiftKey);
  }
 }
 function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); onclose(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); forceSync(); }
 }
 $effect(() => () => { disposed = true; if (applyTimer) clearTimeout(applyTimer); });
</script>

<svelte:window onkeydown={handleKeydown} />



<div class="fixed right-0 top-0 z-50 flex h-full w-full md:w-[560px] md:max-w-[95vw] flex-col border-l border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl panel-slide-in" data-workspace-panel transition:dockPanel|global>

	<div class="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3V7M4 7c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3M4 7c0-2 1.5-3 4-3h8c2.5 0 4 1 4 3" /></svg>
			<h2 class="text-sm font-normal text-[var(--ui-text)]">Live SQL Real Time</h2>
		</div>
		<button
			onclick={onclose}
			class="rounded p-1 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] active:scale-90"
			aria-label="ปิด"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>


	<div class="flex flex-1 flex-col gap-3 overflow-hidden p-5">
		<p class="text-xs text-[var(--ui-text-muted)]">
			ซิงก์อัตโนมัติเมื่อหยุดพิมพ์ 0.6 วินาที ไม่ต้องกดปุ่ม ทุก CREATE TABLE ต้องครบและจบด้วย ; หากแก้ไม่ได้จะแสดงเหตุผลและเก็บ diagram เดิมไว้
		</p>

		<div class="flex items-center gap-2">
			<button
				onclick={forceSync}
				disabled={readOnly || applying}
				class="rounded bg-[var(--ui-accent)] px-3 py-1.5 text-xs font-light text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-40"
			>
				ซิงก์ทันที
			</button>
			<button
				onclick={copySql}
				class="rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
			>
				คัดลอก SQL
			</button>
			{#if applying}
				<span class="ml-auto text-[11px] text-amber-500">กำลังซิงก์…</span>
			{:else if syncError}
				<span role="status" class="ml-auto text-[11px] text-red-500">ยังไม่ได้ซิงก์</span>
			{:else if dirty}
				<span class="ml-auto text-[11px] text-amber-500">รอซิงก์อัตโนมัติ…</span>
			{:else}
				<span class="ml-auto text-[11px] text-[var(--ui-text-muted)]">ซิงก์กับ diagram แล้ว</span>
			{/if}
			<div class="flex items-center gap-1">
				<button
					onclick={undo}
					onmousedown={(e) => e.preventDefault()}
					disabled={(!draftUndo.length && !diagram.canUndo) || readOnly || applying}
					title="ย้อนกลับ (Ctrl+Z)"
					aria-label="ย้อนกลับ"
					class="rounded p-1.5 text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] disabled:opacity-30 active:scale-90"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
				</button>
				<button
					onclick={redo}
					onmousedown={(e) => e.preventDefault()}
					disabled={(!draftRedo.length && !diagram.canRedo) || readOnly || applying}
					title="ทำซ้ำ (Ctrl+Y)"
					aria-label="ทำซ้ำ"
					class="rounded p-1.5 text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] disabled:opacity-30 active:scale-90"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 100 12h3" /></svg>
				</button>
			</div>
		</div>

		<button onclick={refreshSqlFromDiagram} disabled={applying} class="self-start rounded border border-[var(--ui-border)] px-3 py-1.5 text-xs text-[var(--ui-text-secondary)]">โหลด SQL จาก diagram</button>
		{#if externalChanges}<p class="text-xs text-amber-500">มีการแก้ diagram ขณะพิมพ์ SQL ร่างของคุณยังไม่ถูกเขียนทับ</p>{/if}
		{#if syncError}
			<p role="alert" class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">{syncError}</p>
		{/if}

		{#if genWarnings.length > 0}
			<div class="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
				{#each genWarnings as w}
					<div>• {w}</div>
				{/each}
			</div>
		{/if}

		<textarea
			value={sqlText}
			oninput={handleInput}
			onkeydown={handleEditorKeydown}
			readonly={readOnly}
			aria-label="SQL schema"
			spellcheck="false"
			placeholder={'CREATE TABLE "User" (\n  "id" INTEGER PRIMARY KEY,\n  "email" VARCHAR(255)\n);'}
			class="min-h-0 flex-1 w-full resize-none rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 font-mono text-xs leading-relaxed text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:border-[var(--ui-text-muted)] focus:outline-none"
		></textarea>

		<p class="text-[11px] text-[var(--ui-text-muted)]">
			รองรับ PRIMARY KEY, FOREIGN KEY / REFERENCES และตารางเชื่อม (junction) สำหรับ M:N — เก็บชนิดข้อมูลที่ระบุใน SQL และตำแหน่ง Entity เดิมไว้ — เครื่องมือนี้แก้โครงสร้าง diagram ไม่ได้รัน SQL กับฐานข้อมูลจริง
		</p>
	</div>
</div>
