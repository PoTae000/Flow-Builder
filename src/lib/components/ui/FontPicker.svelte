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

	// Merge built-in + custom fonts
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

			// Case 1: fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap
			if (parsed.hostname.includes('fonts.googleapis.com')) {
				const family = parsed.searchParams.get('family');
				if (!family) return null;
				const fontName = family.split(':')[0].replace(/\+/g, ' ');
				if (!fontName.trim()) return null;
				return { fontName: fontName.trim(), cssUrl: url };
			}

			// Case 2: fonts.google.com/specimen/Roboto or fonts.google.com/specimen/Noto+Sans+Thai
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
		// Check if already injected
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

		// Check duplicate
		if (diagram.customFonts.some(f => f.label === fontName)) {
			errorMsg = `"${fontName}" มีอยู่แล้ว`;
			return;
		}

		// Inject <link> to load the font
		injectFontLink(cssUrl, fontName);

		// Add to diagram state
		const fontValue = `'${fontName}', sans-serif`;
		diagram.addCustomFont({ label: fontName, value: fontValue, url: cssUrl });

		// Auto-select the new font
		if (await collab.requestPermission('change-font')) {
			diagram.setDiagramFont(fontValue);
		}

		// Reset input
		urlInput = '';
		showInput = false;
	}

	function removeFont(label: string, e: MouseEvent) {
		e.stopPropagation();
		diagram.removeCustomFont(label);
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
		<span class="text-xs font-normal text-[var(--ui-text-muted)] uppercase tracking-wider">ฟอนต์ Diagram</span>
		<button
			type="button"
			class="flex items-center justify-center w-5 h-5 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition"
			onclick={() => { showInput = !showInput; errorMsg = ''; }}
			aria-label="เพิ่มฟอนต์จาก Google Fonts"
			title="เพิ่มฟอนต์จาก Google Fonts"
		>
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
		</button>
	</div>

	{#if showInput}
		<div class="flex flex-col gap-1.5">
			<div class="flex gap-1">
				<input
					type="text"
					bind:value={urlInput}
					onkeydown={handleKeydown}
					placeholder="วาง Google Fonts URL..."
					class="flex-1 min-w-0 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2.5 py-1.5 text-xs text-[var(--ui-text)] placeholder-[var(--ui-text-muted)] focus:border-[var(--ui-text-secondary)] focus:ring-1 focus:ring-[var(--ui-text-secondary)]/20 focus:outline-none"
				/>
				<button
					type="button"
					onclick={addFont}
					class="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition"
				>
					เพิ่ม
				</button>
			</div>
			{#if errorMsg}
				<p class="text-xs text-red-500">{errorMsg}</p>
			{/if}
			<p class="text-[10px] text-[var(--ui-text-muted)] leading-tight">
				วาง URL จาก Google Fonts ได้เลย เช่น fonts.google.com/specimen/Roboto
			</p>
		</div>
	{/if}

	<CustomSelect options={fontOptions} bind:value={diagram.diagramFont} onchange={handleChange} />

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
