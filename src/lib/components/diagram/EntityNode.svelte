<script lang="ts">
	import type { Entity } from '$lib/types/er';
	import type { Rect } from '$lib/types/geometry';
	import type { NotationRenderer } from '$lib/renderers/types';
	import { theme } from '$lib/stores/theme.svelte';

	let {
		entity,
		rect,
		renderer,
		selected = false,
		onmousedown,
		onclick,
		ontouchstart,
		oncontextmenu
	}: {
		entity: Entity;
		rect: Rect;
		renderer: NotationRenderer;
		selected?: boolean;
		onmousedown?: (e: MouseEvent) => void;
		onclick?: (e: MouseEvent) => void;
		ontouchstart?: (e: TouchEvent) => void;
		oncontextmenu?: (e: MouseEvent) => void;
	} = $props();

	const colors = $derived(theme.colors);
</script>

<g
	class="entity-node"
	class:selected
	role="button"
	tabindex="0"
	aria-label="Entity: {entity.name}"
	onmousedown={onmousedown}
	onclick={onclick}
	ontouchstart={ontouchstart}
	oncontextmenu={oncontextmenu}
	onkeydown={(e) => { if (e.key === 'Enter' && onclick) onclick(e as unknown as MouseEvent); }}
	style="cursor: grab;"
>
	<!-- Selection highlight -->
	{#if selected}
		<rect
			x={rect.x - 2}
			y={rect.y - 2}
			width={rect.width + 4}
			height={rect.height + 4}
			fill="none"
			stroke={colors.selectedStroke}
			stroke-width="2.5"
			opacity="0.5"
		/>
	{/if}

	<!-- Entity box -->
	<rect
		x={rect.x}
		y={rect.y}
		width={rect.width}
		height={rect.height}
		fill={entity.color || colors.entityFill}
		stroke={selected ? colors.selectedStroke : colors.entityStroke}
		stroke-width={entity.isWeak ? 1 : 1.5}
	/>

	<!-- Color header bar (when entity has color and inline attributes) -->
	{#if entity.color && renderer.inlineAttributes}
		<rect
			x={rect.x}
			y={rect.y}
			width={rect.width}
			height={renderer.headerHeight}
			fill={entity.color}
			opacity="0.15"
		/>
	{/if}

	<!-- Double border for weak entity -->
	{#if entity.isWeak}
		<rect
			x={rect.x + 4}
			y={rect.y + 4}
			width={rect.width - 8}
			height={rect.height - 8}
			fill="none"
			stroke={colors.entityStroke}
			stroke-width="1.5"
		/>
	{/if}

	<!-- Entity name -->
	<text
		x={rect.x + rect.width / 2}
		y={renderer.inlineAttributes ? rect.y + renderer.headerHeight / 2 : rect.y + rect.height / 2}
		text-anchor="middle"
		dominant-baseline="central"
		fill={colors.entityHeaderText}
		font-size="14"
		font-weight="700"
	>
		{entity.name}
	</text>

	<!-- Separator line (only for inline attribute notations) -->
	{#if renderer.inlineAttributes}
		<line
			x1={rect.x}
			y1={rect.y + renderer.headerHeight}
			x2={rect.x + rect.width}
			y2={rect.y + renderer.headerHeight}
			stroke={colors.entityStroke}
			stroke-width="1"
		/>
	{/if}

	<!-- Attributes (inline mode) -->
	{#if renderer.inlineAttributes}
		{#each entity.attributes as attr, i}
			{@const attrY = rect.y + renderer.headerHeight + i * renderer.attributeRowHeight + renderer.attributeRowHeight / 2 + 4}
			<!-- PK/FK label -->
			{#if attr.type === 'primary_key'}
				<text
					x={rect.x + 8}
					y={attrY}
					font-size="10"
					fill={colors.pkColor}
					dominant-baseline="central"
					font-weight="700"
				>PK</text>
			{:else if attr.type === 'foreign_key'}
				<text
					x={rect.x + 8}
					y={attrY}
					font-size="10"
					fill={colors.fkColor}
					dominant-baseline="central"
					font-weight="700"
				>FK</text>
			{/if}

			<!-- Attribute name -->
			<text
				x={rect.x + (attr.type === 'primary_key' || attr.type === 'foreign_key' ? 28 : 10)}
				y={attrY}
				font-size="12"
				fill={colors.entityText}
				dominant-baseline="central"
				text-decoration={attr.type === 'primary_key' ? 'underline' : 'none'}
			>
				{attr.name}
			</text>
		{/each}

		{#if entity.attributes.length === 0}
			<text
				x={rect.x + rect.width / 2}
				y={rect.y + renderer.headerHeight + 16}
				text-anchor="middle"
				dominant-baseline="central"
				font-size="11"
				fill={colors.attrText}
				opacity="0.4"
			>
				(no attributes)
			</text>
		{/if}
	{/if}
</g>
