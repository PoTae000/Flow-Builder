<script lang="ts">
	import type { Entity } from '$lib/types/er';
	import type { Rect } from '$lib/types/geometry';
	import type { NotationRenderer } from '$lib/renderers/types';
	import { theme } from '$lib/stores/theme.svelte';
	import { tweened } from 'svelte/motion';

	let {
		entity,
		rect,
		renderer,
		selected = false,
		highlighted = false,
		animateIn = false,
		dimmed = false,
		missingPk = false,
		isOrphan = false,
		morphing = false,
		onmousedown,
		onclick,
		ondblclick,
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
		missingPk?: boolean;
		isOrphan?: boolean;
		morphing?: boolean;
		dragging?: boolean;
		onmousedown?: (e: MouseEvent) => void;
		onclick?: (e: MouseEvent) => void;
		ondblclick?: (e: MouseEvent) => void;
		ontouchstart?: (e: TouchEvent) => void;
		oncontextmenu?: (e: MouseEvent) => void;
		remoteSelectors?: Array<{ color: string; name: string }>;
	} = $props();

	const colors = $derived(theme.colors);

	// Custom easing: cubic-out with slight overshoot (back-out)
	function backOut(t: number): number {
		const s = 1.4;
		return 1 + (--t) * t * ((s + 1) * t + s);
	}

	// Tweened rect for smooth morph animation
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

	// Derived display values from tweened store
	const r = $derived($tr);
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
	<!-- Selection highlight -->
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

	<!-- Remote user selection indicators -->
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
			<!-- Name badge -->
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

	<!-- SQL Visualizer highlight -->
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

	<!-- Entity box -->
	<rect
		x={r.x}
		y={r.y}
		width={r.w}
		height={r.h}
		fill={entity.color || colors.entityFill}
		stroke={selected ? colors.selectedStroke : colors.entityStroke}
		stroke-width={entity.isWeak ? 1 : 1.5}
	/>

	<!-- Color header bar (when entity has color and inline attributes) -->
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

	<!-- Double border for weak entity -->
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

	<!-- Entity name -->
	<text
		x={r.x + r.w / 2}
		y={renderer.inlineAttributes ? r.y + renderer.headerHeight / 2 : r.y + r.h / 2}
		text-anchor="middle"
		dominant-baseline="central"
		fill={colors.entityHeaderText}
		font-size="14"
		font-weight="700"
	>
		{entity.name}
	</text>

	<!-- Lock icon -->
	{#if entity.isLocked}
		<g transform="translate({r.x + r.w - 18}, {r.y + 4})">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.attrText} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6">
				<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		</g>
	{/if}

	<!-- Warning badges -->
	{#if missingPk || isOrphan}
		{@const badgeX = r.x + r.w - (entity.isLocked ? 22 : 6)}
		{#if missingPk}
			<g class="warning-badge" transform="translate({badgeX}, {r.y - 4})">
				<circle r="6" fill="#ef4444" opacity="0.9" />
				<text text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="700" fill="white">!</text>
				<title>Missing Primary Key</title>
			</g>
		{/if}
		{#if isOrphan}
			<g class="warning-badge" transform="translate({badgeX - (missingPk ? 15 : 0)}, {r.y - 4})">
				<circle r="6" fill="#f97316" opacity="0.9" />
				<text text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="700" fill="white">○</text>
				<title>ไม่มีความสัมพันธ์กับ Entity อื่น</title>
			</g>
		{/if}
	{/if}

	<!-- Separator line (only for inline attribute notations) -->
	{#if renderer.inlineAttributes}
		<line
			x1={r.x}
			y1={r.y + renderer.headerHeight}
			x2={r.x + r.w}
			y2={r.y + renderer.headerHeight}
			stroke={colors.entityStroke}
			stroke-width="1"
		/>
	{/if}

	<!-- Attributes (inline mode) -->
	{#if renderer.inlineAttributes}
		{@const hasPkFk = entity.attributes.some(a => a.type === 'primary_key' || a.type === 'foreign_key')}
		{@const pkFkColWidth = 28}
		{@const attrStartX = hasPkFk ? r.x + pkFkColWidth : r.x + 10}
		<g class="entity-attrs" class:attr-morph-in={morphing}>

		<!-- Vertical separator between PK/FK column and attribute names -->
		{#if hasPkFk && entity.attributes.length > 0}
			<line
				x1={r.x + pkFkColWidth - 2}
				y1={r.y + renderer.headerHeight}
				x2={r.x + pkFkColWidth - 2}
				y2={r.y + r.h}
				stroke={colors.entityStroke}
				stroke-width="1"
			/>
		{/if}

		{#each entity.attributes as attr, i}
			{@const attrY = r.y + renderer.headerHeight + i * renderer.attributeRowHeight + renderer.attributeRowHeight / 2 + 4}
			<!-- PK/FK label -->
			{#if attr.type === 'primary_key'}
				<text
					x={r.x + 8}
					y={attrY}
					font-size="10"
					fill={colors.entityText}
					dominant-baseline="central"
					font-weight="700"
				>PK</text>
			{:else if attr.type === 'foreign_key'}
				<text
					x={r.x + 8}
					y={attrY}
					font-size="10"
					fill={colors.entityText}
					dominant-baseline="central"
					font-weight="700"
				>FK</text>
			{/if}

			<!-- Attribute name -->
			{@const attrTextX = hasPkFk ? attrStartX + 4 : attrStartX}
			<text
				x={attrTextX}
				y={attrY}
				font-size="12"
				fill={colors.entityText}
				dominant-baseline="central"
			>
				{attr.name}
			</text>
			<!-- PK underline — drawn manually to avoid overlapping underscore characters -->
			{#if attr.type === 'primary_key'}
				<line
					x1={attrTextX}
					y1={attrY + 9}
					x2={attrTextX + attr.name.length * 7.2}
					y2={attrY + 9}
					stroke={colors.entityText}
					stroke-width="1"
				/>
			{/if}
		{/each}

		{#if entity.attributes.length === 0}
			<text
				x={r.x + r.w / 2}
				y={r.y + renderer.headerHeight + 16}
				text-anchor="middle"
				dominant-baseline="central"
				font-size="11"
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
	@keyframes badgePulse { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.5; } }
	.warning-badge { animation: badgePulse 2s ease-in-out infinite; }

	/* Attribute fade-in during notation morph (e.g. Chen → Crow's Foot) */
	@keyframes attrFadeIn { from { opacity: 0; } to { opacity: 1; } }
	.entity-attrs.attr-morph-in { animation: attrFadeIn 0.4s ease-out 0.45s both; }
</style>
