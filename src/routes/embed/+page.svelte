<script lang="ts">
	import { onMount, tick } from 'svelte';
	import DiagramCanvas from '$lib/components/diagram/DiagramCanvas.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { resolveShareData } from '$lib/utils/share';

	let ready = $state(false);
	let error = $state(false);
	let canvasComponent: DiagramCanvas | undefined = $state();

	const diagramLabel = $derived(
		diagram.diagramType === 'flowchart' ? 'Flowchart' :
		diagram.diagramType === 'context' ? 'DFD' : 'ER Diagram'
	);

	onMount(async () => {
		
		diagram.viewOnly = true;

		const data = await resolveShareData(window.location.search, window.location.hash);
		if (!data) {
			error = true;
			ready = true;
			return;
		}

		diagram.entities = data.entities ?? [];
		diagram.relationships = data.relationships ?? [];
		diagram.notes = data.notes ?? [];
		diagram.notation = data.notation ?? 'crows-foot';
		diagram.diagramFont = data.diagramFont ?? "'TH Sarabun PSK', 'Sarabun', sans-serif";
		diagram.diagramFontSize = data.diagramFontSize ?? 14;
		diagram.diagramType = data.diagramType ?? 'er';
		diagram.flowNodes = data.flowNodes ?? [];
		diagram.flowEdges = data.flowEdges ?? [];
		diagram.dfdNodes = data.dfdNodes ?? [];
		diagram.dfdFlows = data.dfdFlows ?? [];
		diagram.panX = data.panX ?? 0;
		diagram.panY = data.panY ?? 0;
		diagram.zoom = data.zoom ?? 1;
		diagram.viewOnly = true;

		ready = true;
		
		await tick();
		requestAnimationFrame(() => canvasComponent?.fitToContent());
	});

	const siteUrl = 'https://suepskun.online';
</script>

<svelte:head>
	<title>{diagramLabel} — Flow-Builder</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="fixed inset-0 h-full w-full overflow-hidden" style="background: {theme.colors.canvasBg};">
	{#if ready && !error}
		<DiagramCanvas bind:this={canvasComponent} />

		
		<div class="absolute bottom-3 right-3 z-10 flex flex-col gap-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)]/90 p-1 shadow-lg backdrop-blur">
			<button
				onclick={() => diagram.setZoom(Math.min(3, diagram.zoom * 1.2))}
				class="flex h-7 w-7 items-center justify-center rounded text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				aria-label="ซูมเข้า" title="ซูมเข้า"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
			</button>
			<button
				onclick={() => canvasComponent?.fitToContent()}
				class="flex h-7 w-7 items-center justify-center rounded text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				aria-label="พอดีเนื้อหา" title="พอดีเนื้อหา"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
			</button>
			<button
				onclick={() => diagram.setZoom(Math.max(0.25, diagram.zoom / 1.2))}
				class="flex h-7 w-7 items-center justify-center rounded text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
				aria-label="ซูมออก" title="ซูมออก"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" /></svg>
			</button>
		</div>

		
		<a
			href={siteUrl}
			target="_blank"
			rel="noopener"
			class="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)]/90 px-2.5 py-1.5 text-[11px] font-medium text-[var(--ui-text-secondary)] shadow-lg backdrop-blur transition hover:text-[var(--ui-text)]"
		>
			<svg class="h-3.5 w-3.5 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
			สร้างด้วย Flow-Builder
		</a>
	{:else if error}
		<div class="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
			<svg class="h-10 w-10 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" /></svg>
			<p class="text-sm text-[var(--ui-text-secondary)]">ไม่พบข้อมูล diagram ในลิงก์นี้</p>
			<a href={siteUrl} target="_blank" rel="noopener" class="text-xs text-[var(--ui-accent)] hover:underline">เปิด Flow-Builder</a>
		</div>
	{:else}
		<div class="flex h-full w-full items-center justify-center">
			<svg class="h-6 w-6 animate-spin text-[var(--ui-text-muted)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
		</div>
	{/if}
</div>
