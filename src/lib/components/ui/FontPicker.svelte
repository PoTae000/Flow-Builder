<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import CustomSelect from './CustomSelect.svelte';

	const builtinFontOptions = [
		{ value: "'TH Sarabun PSK', 'Sarabun', sans-serif", label: 'TH Sarabun PSK' },
		{ value: "'Sarabun', sans-serif", label: 'Sarabun' },
		{ value: "'Kanit', sans-serif", label: 'Kanit' },
		{ value: "'Noto Sans Thai', sans-serif", label: 'Noto Sans Thai' },
		{ value: "Arial, Helvetica, sans-serif", label: 'Arial' },
		{ value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
		{ value: "'Courier New', Courier, monospace", label: 'Courier New' },
		{ value: "'Tahoma', Geneva, sans-serif", label: 'Tahoma' },
	];


	const fontOptions = $derived([
		...builtinFontOptions,
		...diagram.customFonts.map(f => ({ value: f.value, label: f.label }))
	]);

	let showInput = $state(false);
	let urlInput = $state('');
	let errorMsg = $state('');

	async function handleChange(val: string): Promise<boolean | void> {
		if (val === diagram.diagramFont) return;
		if (await collab.requestPermission('change-font')) {
			diagram.setDiagramFont(val);
		} else {
			return false;
		}
	}

	function parseGoogleFontsUrl(url: string): { fontName: string; cssUrl: string } | null {
		try {
			const parsed = new URL(url);


			if (parsed.hostname.includes('fonts.googleapis.com')) {
				const family = parsed.searchParams.get('family');
				if (!family) return null;
				const fontName = family.split(':')[0].replace(/\+/g, ' ');
				if (!fontName.trim()) return null;
				return { fontName: fontName.trim(), cssUrl: url };
			}


			if (parsed.hostname.includes('fonts.google.com') && parsed.pathname.includes('/specimen/')) {
				const parts = parsed.pathname.split('/specimen/');
				if (parts.length < 2 || !parts[1]) return null;
				const fontName = decodeURIComponent(parts[1].split('/')[0].split('?')[0]).replace(/\+/g, ' ');
				if (!fontName.trim()) return null;
				const encodedName = fontName.trim().replace(/\s+/g, '+');
				const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedName}:wght@300;400;500;700&display=swap`;
				return { fontName: fontName.trim(), cssUrl };
			}

			return null;
		} catch {
			return null;
		}
	}

	function injectFontLink(url: string, fontName: string) {

		const existing = document.querySelector(`link[data-custom-font="${fontName}"]`);
		if (existing) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = url;
		link.dataset.customFont = fontName;
		document.head.appendChild(link);
	}

	async function addFont() {
		errorMsg = '';
		const trimmed = urlInput.trim();
		if (!trimmed) {
			errorMsg = 'กรุณาวาง URL';
			return;
		}

		const parsed = parseGoogleFontsUrl(trimmed);
		if (!parsed) {
			errorMsg = 'URL ไม่ถูกต้อง (ต้องเป็น Google Fonts URL)';
			return;
		}

		const { fontName, cssUrl } = parsed;


		if (diagram.customFonts.some(f => f.label === fontName)) {
			errorMsg = `"${fontName}" มีอยู่แล้ว`;
			return;
		}


		injectFontLink(cssUrl, fontName);


		const fontValue = `'${fontName}', sans-serif`;
		diagram.addCustomFont({ label: fontName, value: fontValue, url: cssUrl });


		if (await collab.requestPermission('change-font')) {
			diagram.setDiagramFont(fontValue);
		}


		urlInput = '';
		showInput = false;
	}

	function removeFont(label: string, e: MouseEvent) {
		e.stopPropagation();
		diagram.removeCustomFont(label);
	}

	function closeFontModal() { showInput = false; urlInput = ''; errorMsg = ''; }
	function modalRoot(node: HTMLDivElement) {
	 const previous = document.activeElement as HTMLElement | null;
	 document.body.appendChild(node);
	 node.querySelector('input')?.focus();
	 return { destroy() { node.remove(); previous?.focus(); } };
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addFont();
		} else if (e.key === 'Escape') {
			showInput = false;
			urlInput = '';
			errorMsg = '';
		}
	}
</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-center justify-between">
		<button
			type="button"
			class="flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition"
			onclick={() => { showInput = !showInput; errorMsg = ''; }}
			aria-label="เพิ่มฟอนต์จาก Google Fonts"
			title="เพิ่มฟอนต์จาก Google Fonts"
		>
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			<span class="text-xs">เพิ่ม font</span>
		</button>
	</div>




	<div class="flex items-stretch gap-1.5">
		<div class="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 focus-within:border-[var(--ui-text-secondary)]">
			<input
				type="number"
				min="8"
				max="48"
				value={diagram.diagramFontSize}
				onchange={(e) => diagram.setDiagramFontSize(parseInt(e.currentTarget.value) || 14)}
				class="w-8 border-none bg-transparent text-center text-sm font-medium tabular-nums text-[var(--ui-text)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				aria-label="ขนาดตัวอักษร"
				title="ขนาดตัวอักษร"
			/>
			<span class="text-[10px] text-[var(--ui-text-muted)]">px</span>
		</div>
		<div class="min-w-0 flex-1">
			<CustomSelect options={fontOptions} bind:value={diagram.diagramFont} onchange={handleChange} />
		</div>
	</div>

	{#if diagram.customFonts.length > 0}
		<div class="flex flex-col gap-0.5">
			<span class="text-[10px] text-[var(--ui-text-muted)] uppercase tracking-wider">Custom Fonts</span>
			{#each diagram.customFonts as font}
				<div class="flex items-center justify-between gap-1 px-2 py-1 rounded text-xs text-[var(--ui-text-secondary)] bg-[var(--ui-bg-secondary)]">
					<span class="truncate" style="font-family: '{font.label}', sans-serif">{font.label}</span>
					<button
						type="button"
						onclick={(e) => removeFont(font.label, e)}
						class="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-red-500/20 hover:text-red-500 transition"
						aria-label="ลบฟอนต์ {font.label}"
						title="ลบ {font.label}"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showInput}
 <!-- svelte-ignore a11y_no_static_element_interactions -->
 <div use:modalRoot onkeydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); closeFontModal(); } e.stopPropagation(); }}>
  <button tabindex="-1" aria-label="ปิดหน้าต่างเพิ่มฟอนต์" onclick={closeFontModal} class="fixed inset-0 z-[210] cursor-default bg-black/50 backdrop-blur-[2px] dialog-backdrop"></button>
  <section role="dialog" aria-modal="true" aria-labelledby="add-font-title" class="fixed left-1/2 top-1/2 z-[211] w-[calc(100vw-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-5 shadow-2xl dialog-content">
   <div class="mb-4 flex items-center justify-between"><h2 id="add-font-title" class="text-sm font-medium text-[var(--ui-text)]">เพิ่ม font</h2><button aria-label="ปิด" onclick={closeFontModal} class="rounded p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div>
   <label for="font-url" class="mb-2 block text-xs text-[var(--ui-text-secondary)]">Google Fonts URL</label>
   <input id="font-url" type="url" bind:value={urlInput} onkeydown={handleKeydown} placeholder="https://fonts.google.com/specimen/Roboto" class="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-3 py-2 text-sm text-[var(--ui-text)] focus:border-[var(--ui-accent)] focus:outline-none" />
   <p class="mt-2 text-xs text-[var(--ui-text-muted)]">วางลิงก์หน้าฟอนต์จาก Google Fonts เพื่อเพิ่มลงในรายการ</p>
   {#if errorMsg}<p role="alert" class="mt-2 text-xs text-red-500">{errorMsg}</p>{/if}
   <div class="mt-5 flex justify-end gap-2"><button onclick={closeFontModal} class="rounded-lg border border-[var(--ui-border)] px-4 py-1.5 text-xs text-[var(--ui-text-secondary)] hover:bg-[var(--ui-hover)]">ยกเลิก</button><button onclick={addFont} disabled={!urlInput.trim()} class="rounded-lg bg-[var(--ui-accent)] px-4 py-1.5 text-xs text-[var(--ui-accent-text)] hover:opacity-90 disabled:opacity-40">เพิ่ม font</button></div>
  </section>
 </div>
{/if}
