<script lang="ts">
	import EditableAttributeText from './EditableAttributeText.svelte';
	import type { Entity } from '$lib/types/er';
	import type { Rect } from '$lib/types/geometry';
	import type { NotationRenderer } from '$lib/renderers/types';
	import { theme } from '$lib/stores/theme.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { measureNodeText } from '$lib/utils/text-measure';
	import { tweened } from 'svelte/motion';

	let {
		entity,
		rect,
		renderer,
		selected = false,
		highlighted = false,
		animateIn = false,
		dimmed = false,
		morphing = false,
		onmousedown,
		onclick,
		ondblclick,
		onattributeedit,
		ontouchstart,
		oncontextmenu,
		dragging = false,
		remoteSelectors
	}: {
		entity: Entity;
		rect: Rect;
		renderer: NotationRenderer;
		selected?: boolean;
		highlighted?: boolean;
		animateIn?: boolean;
		dimmed?: boolean;
		morphing?: boolean;
		dragging?: boolean;
		onmousedown?: (e: MouseEvent) => void;
		onclick?: (e: MouseEvent) => void;
		ondblclick?: (e: MouseEvent) => void;
		onattributeedit?: () => void;
		ontouchstart?: (e: TouchEvent) => void;
		oncontextmenu?: (e: MouseEvent) => void;
		remoteSelectors?: Array<{ color: string; name: string }>;
	} = $props();

	const colors = $derived(theme.colors);
	const accent = $derived(theme.erColorful ? theme.erAccent(entity.id) : colors.entityStroke);
	const bodyFill = $derived(entity.color || (theme.erColorful ? (theme.isDark ? '#18202e' : '#ffffff') : colors.entityFill));


	function backOut(t: number): number {
		const s = 1.4;
		return 1 + (--t) * t * ((s + 1) * t + s);
	}


	const tr = tweened(
		{ x: rect.x, y: rect.y, w: rect.width, h: rect.height },
		{ duration: 0, easing: backOut }
	);

	$effect(() => {
		tr.set(
			{ x: rect.x, y: rect.y, w: rect.width, h: rect.height },
			{ duration: morphing ? 450 : 0 }
		);
	});


	const r = $derived($tr);




	const fontScale = $derived((entity.fontSize ?? diagram.diagramFontSize) / 14);
	const isBold = $derived(entity.bold ?? true);
	const isItalic = $derived(entity.italic ?? false);
	const headerH = $derived(renderer.headerHeight * fontScale);
	const rowH = $derived(renderer.attributeRowHeight * fontScale);
	const nameFont = $derived(14 * fontScale);
	const attrFont = $derived(12 * fontScale);
	const pkFont = $derived(10 * fontScale);
</script>

<g
	class="entity-node"
	class:selected
	class:animate-in={animateIn}
	class:dimmed
	class:dragging
	role="button"
	tabindex="0"
	aria-label="Entity: {entity.name}"
	onmousedown={onmousedown}
	onclick={onclick}
	ondblclick={ondblclick}
	ontouchstart={ontouchstart}
	oncontextmenu={oncontextmenu}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: {dragging ? 'grabbing' : entity.isLocked ? 'default' : 'grab'};"
>

	{#if selected}
		<rect
			class="selection-rect"
			x={r.x - 2}
			y={r.y - 2}
			width={r.w + 4}
			height={r.h + 4}
			fill="none"
			stroke={colors.selectedStroke}
			stroke-width="2.5"
			opacity="0.5"
		/>
	{/if}


	{#if remoteSelectors && remoteSelectors.length > 0}
		{#each remoteSelectors as sel, idx}
			{@const offset = 4 + idx * 3}
			<rect
				x={r.x - offset}
				y={r.y - offset}
				width={r.w + offset * 2}
				height={r.h + offset * 2}
				fill="none"
				stroke={sel.color}
				stroke-width="2"
				stroke-dasharray="6 3"
				opacity="0.7"
				rx="2"
			/>

			<g transform="translate({r.x + r.w + offset - 2}, {r.y - offset - 2})">
				<rect
					x="-2"
					y="-12"
					width={sel.name.length * 6.5 + 8}
					height="14"
					rx="3"
					fill={sel.color}
					opacity="0.85"
				/>
				<text
					x={sel.name.length * 6.5 / 2 + 2}
					y="-4"
					text-anchor="middle"
					font-size="9"
					fill="white"
					font-weight="600"
				>{sel.name}</text>
			</g>
		{/each}
	{/if}


	{#if highlighted}
		<rect
			x={r.x - 4}
			y={r.y - 4}
			width={r.w + 8}
			height={r.h + 8}
			fill="none"
			stroke="#3b82f6"
			stroke-width="2"
			stroke-dasharray="6 3"
			opacity="0.7"
		/>
	{/if}


	<rect
		x={r.x}
		y={r.y}
		width={r.w}
		height={r.h}
		fill={bodyFill}
		stroke={selected ? colors.selectedStroke : accent}
		rx="0"
		stroke-width={entity.isWeak ? 1 : 1.5}
	/>

	{#if theme.erColorful}
		<rect x={r.x + 1} y={r.y + 1} width={Math.max(0, r.w - 2)} height={Math.max(0, (renderer.inlineAttributes ? headerH : r.h) - 2)} fill={accent} fill-opacity={theme.isDark ? 0.2 : 0.16} pointer-events="none" />
	{/if}

	{#if entity.color && renderer.inlineAttributes}
		<rect
			x={r.x}
			y={r.y}
			width={r.w}
			height={renderer.headerHeight}
			fill={entity.color}
			opacity="0.15"
		/>
	{/if}


	{#if entity.isWeak}
		<rect
			x={r.x + 4}
			y={r.y + 4}
			width={r.w - 8}
			height={r.h - 8}
			fill="none"
			stroke={colors.entityStroke}
			stroke-width="1.5"
		/>
	{/if}


	<text
		x={r.x + r.w / 2}
		y={renderer.inlineAttributes ? r.y + headerH / 2 : r.y + r.h / 2}
		text-anchor="middle"
		dominant-baseline="central"
		fill={colors.entityHeaderText}
		font-size={nameFont}
		font-weight={isBold ? 700 : 400}
		font-style={isItalic ? 'italic' : 'normal'}
	>
		{entity.name}
	</text>


	{#if entity.isLocked && diagram.zoom >= 0.5}
		<g transform="translate({r.x + r.w}, {r.y}) scale({0.65 / Math.max(1, diagram.zoom)})" role="button" tabindex="0" aria-label="ปลดล็อกตำแหน่ง" style="cursor: pointer;"
			onmousedown={(event) => event.stopPropagation()}
			ondblclick={(event) => event.stopPropagation()}
			onclick={(event) => { event.stopPropagation(); diagram.toggleLockEntity(entity.id); }}
			onkeydown={(event) => { event.stopPropagation(); if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); diagram.toggleLockEntity(entity.id); } }}>
			<title>ล็อกตำแหน่งอยู่ · คลิกเพื่อปลดล็อก</title>
			<rect x="-10" y="-10" width="22" height="22" rx="7" fill={theme.isDark ? '#30271a' : '#fff7e6'} stroke="#b88a39" stroke-width="1" />
			<svg x="-6" y="-6" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.isDark ? '#edbc68' : '#986513'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		</g>
	{/if}


	{#if renderer.inlineAttributes}
		<line
			x1={r.x}
			y1={r.y + headerH}
			x2={r.x + r.w}
			y2={r.y + headerH}
			stroke={colors.entityStroke}
			stroke-width="1"
		/>
	{/if}


	{#if renderer.inlineAttributes}
		{@const hasPkFk = entity.attributes.some(a => a.type === 'primary_key' || a.type === 'foreign_key')}
		{@const pkFkColWidth = 28}
		{@const attrStartX = hasPkFk ? r.x + pkFkColWidth : r.x + 10}
		<g class="entity-attrs" class:attr-morph-in={morphing}>


		{#if hasPkFk && entity.attributes.length > 0}
			<line
				x1={r.x + pkFkColWidth - 2}
				y1={r.y + headerH}
				x2={r.x + pkFkColWidth - 2}
				y2={r.y + r.h}
				stroke={colors.entityStroke}
				stroke-width="1"
			/>
		{/if}

		{#each entity.attributes as attr, i}
			{@const attrY = r.y + headerH + i * rowH + rowH / 2 + 4}

			{#if attr.type === 'primary_key'}
				<text
					x={r.x + 8}
					y={attrY}
					font-size={pkFont}
					fill={colors.entityText}
					dominant-baseline="central"
					font-weight="700"
				>PK</text>
			{:else if attr.type === 'foreign_key'}
				<text
					x={r.x + 8}
					y={attrY}
					font-size={pkFont}
					fill={colors.entityText}
					dominant-baseline="central"
					font-weight="700"
				>FK</text>
			{/if}


			{@const attrTextX = hasPkFk ? attrStartX + 4 : attrStartX}
			<EditableAttributeText onedit={onattributeedit} entityId={entity.id} attribute={attr} x={attrTextX} y={attrY - rowH / 2} width={r.x + r.w - attrTextX - 4} height={rowH} fontSize={attrFont}>
<text
				x={attrTextX}
				y={attrY}
				font-size={attrFont}
				fill={colors.entityText}
				dominant-baseline="central"
				font-style={isItalic ? 'italic' : 'normal'}
			>
				{attr.name}
			</text>
</EditableAttributeText>

			{#if attr.type === 'primary_key'}
				{@const uw = measureNodeText(attr.name, attrFont, diagram.diagramFont, false).textWidth}
				<line
					x1={attrTextX}
					y1={attrY + 11 * fontScale}
					x2={attrTextX + uw}
					y2={attrY + 11 * fontScale}
					stroke={colors.entityText}
					stroke-width="1"
				/>
			{/if}
		{/each}

		{#if entity.attributes.length === 0}
			<text
				x={r.x + r.w / 2}
				y={r.y + headerH + 16 * fontScale}
				text-anchor="middle"
				dominant-baseline="central"
				font-size={11 * fontScale}
				fill={colors.attrText}
				opacity="0.4"
			>
				(no attributes)
			</text>
		{/if}
		</g>
	{/if}
</g>

<style>
	@keyframes entityAppear {
		from { opacity: 0; transform: scale(0.8); }
		to { opacity: 1; transform: scale(1); }
	}
	.entity-node.animate-in {
		animation: entityAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		transform-origin: center;
		transform-box: fill-box;
	}
	@keyframes selectionPulse {
		0%, 100% { filter: drop-shadow(0 0 4px rgba(59,130,246,0.3)); }
		50% { filter: drop-shadow(0 0 10px rgba(59,130,246,0.6)); }
	}
	.entity-node { transition: filter 0.15s ease, opacity 0.3s ease; }
	.entity-node.selected { animation: selectionPulse 2s ease-in-out infinite; }
	.entity-node:hover { filter: drop-shadow(0 0 4px rgba(59,130,246,0.2)); }
	.entity-node.dragging { filter: drop-shadow(0 6px 12px rgba(0,0,0,0.3)) drop-shadow(0 2px 4px rgba(0,0,0,0.15)); }
	.entity-node.dimmed { opacity: 0.15; filter: grayscale(0.5); pointer-events: none; }
	@keyframes selectionAppear { from { opacity: 0; } to { opacity: 0.5; } }
	.selection-rect { animation: selectionAppear 0.15s ease-out; }

	/* Attribute fade-in during notation morph (e.g. Chen → Crow's Foot) */
	@keyframes attrFadeIn { from { opacity: 0; } to { opacity: 1; } }
	.entity-attrs.attr-morph-in { animation: attrFadeIn 0.4s ease-out 0.45s both; }
</style>
