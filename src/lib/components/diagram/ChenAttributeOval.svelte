<script lang="ts">
	import type { Attribute } from '$lib/types/er';
	import type { Rect } from '$lib/types/geometry';
	import { theme } from '$lib/stores/theme.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { onDestroy } from 'svelte';

	let {
		attribute,
		entityRect,
		entityId,
		index,
		totalAttributes,
		occupiedSides = [],
		screenToSvg
	}: {
		attribute: Attribute;
		entityRect: Rect;
		entityId: string;
		index: number;
		totalAttributes: number;
		occupiedSides?: string[];
		screenToSvg: (clientX: number, clientY: number) => { x: number; y: number };
	} = $props();

	const colors = $derived(theme.colors);

	// Entity center
	const entityCx = $derived(entityRect.x + entityRect.width / 2);
	const entityCy = $derived(entityRect.y + entityRect.height / 2);

	// Determine available arc for placing attributes
	const angleRange = $derived.by(() => {
		const avoidAngles: number[] = [];
		for (const side of occupiedSides) {
			switch (side) {
				case 'top': avoidAngles.push(-Math.PI / 2); break;
				case 'right': avoidAngles.push(0); break;
				case 'bottom': avoidAngles.push(Math.PI / 2); break;
				case 'left': avoidAngles.push(Math.PI); break;
			}
		}

		const candidateStarts = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
		let bestStart = -Math.PI / 2;
		let bestDist = 0;

		for (const cs of candidateStarts) {
			let minDist = Infinity;
			for (const av of avoidAngles) {
				let diff = Math.abs(cs - av);
				if (diff > Math.PI) diff = 2 * Math.PI - diff;
				minDist = Math.min(minDist, diff);
			}
			if (minDist > bestDist) {
				bestDist = minDist;
				bestStart = cs;
			}
		}

		const spread = Math.min(Math.PI * 1.4, Math.PI * 0.4 * Math.max(totalAttributes, 2));
		return { start: bestStart, spread };
	});

	const computedAngle = $derived.by(() => {
		const { start, spread } = angleRange;
		if (totalAttributes <= 1) return start;
		const startAngle = start - spread / 2;
		return startAngle + (index / (totalAttributes - 1)) * spread;
	});

	const distance = 90;
	const ovalRx = 38;
	const ovalRy = 16;

	// Use custom position if available, otherwise computed
	const cx = $derived(attribute.position ? attribute.position.x : entityCx + Math.cos(computedAngle) * distance);
	const cy = $derived(attribute.position ? attribute.position.y : entityCy + Math.sin(computedAngle) * distance);

	// Drag handling
	let dragging = $state(false);
	let dragOffset = { dx: 0, dy: 0 };
	let activeMoveHandler: ((ev: MouseEvent) => void) | null = null;
	let activeUpHandler: (() => void) | null = null;
	let activeTouchMoveHandler: ((ev: TouchEvent) => void) | null = null;
	let activeTouchEndHandler: (() => void) | null = null;

	function cleanupDragListeners() {
		if (activeMoveHandler) {
			window.removeEventListener('mousemove', activeMoveHandler);
			activeMoveHandler = null;
		}
		if (activeUpHandler) {
			window.removeEventListener('mouseup', activeUpHandler);
			activeUpHandler = null;
		}
		if (activeTouchMoveHandler) {
			window.removeEventListener('touchmove', activeTouchMoveHandler);
			activeTouchMoveHandler = null;
		}
		if (activeTouchEndHandler) {
			window.removeEventListener('touchend', activeTouchEndHandler);
			activeTouchEndHandler = null;
		}
		dragging = false;
	}

	function handleMouseDown(e: MouseEvent) {
		if (e.button !== 0 || collab.isViewer) return;
		e.stopPropagation();
		e.preventDefault();
		const svgPos = screenToSvg(e.clientX, e.clientY);
		dragOffset = { dx: svgPos.x - cx, dy: svgPos.y - cy };
		dragging = true;
		diagram.pushHistory();

		activeMoveHandler = (ev: MouseEvent) => {
			const pos = screenToSvg(ev.clientX, ev.clientY);
			diagram.moveAttributePosition(entityId, attribute.id, {
				x: pos.x - dragOffset.dx,
				y: pos.y - dragOffset.dy
			});
		};

		activeUpHandler = () => {
			cleanupDragListeners();
		};

		window.addEventListener('mousemove', activeMoveHandler);
		window.addEventListener('mouseup', activeUpHandler);
	}

	function handleTouchStart(e: TouchEvent) {
		if (collab.isViewer || e.touches.length !== 1) return;
		e.stopPropagation();
		e.preventDefault();
		const touch = e.touches[0];
		const svgPos = screenToSvg(touch.clientX, touch.clientY);
		dragOffset = { dx: svgPos.x - cx, dy: svgPos.y - cy };
		dragging = true;
		diagram.pushHistory();

		activeTouchMoveHandler = (ev: TouchEvent) => {
			if (ev.touches.length !== 1) return;
			ev.preventDefault();
			const t = ev.touches[0];
			const pos = screenToSvg(t.clientX, t.clientY);
			diagram.moveAttributePosition(entityId, attribute.id, {
				x: pos.x - dragOffset.dx,
				y: pos.y - dragOffset.dy
			});
		};

		activeTouchEndHandler = () => {
			cleanupDragListeners();
		};

		window.addEventListener('touchmove', activeTouchMoveHandler, { passive: false });
		window.addEventListener('touchend', activeTouchEndHandler);
	}

	onDestroy(() => {
		cleanupDragListeners();
	});

	// Double-click to reset to auto position
	function handleDblClick(e: MouseEvent) {
		e.stopPropagation();
		if (attribute.position) {
			diagram.pushHistory();
			diagram.moveAttributePosition(entityId, attribute.id, undefined as unknown as { x: number; y: number });
			// Clear position
			const entity = diagram.entities.find((en) => en.id === entityId);
			const attr = entity?.attributes.find((a) => a.id === attribute.id);
			if (attr) {
				delete attr.position;
			}
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
	class="chen-attribute"
	style="cursor: {dragging ? 'grabbing' : 'grab'};"
	onmousedown={handleMouseDown}
	ontouchstart={handleTouchStart}
	ondblclick={handleDblClick}
>
	<!-- Line from entity to attribute oval -->
	<line
		x1={entityCx}
		y1={entityCy}
		x2={cx}
		y2={cy}
		stroke={colors.chenOvalStroke}
		stroke-width="1"
		stroke-dasharray={attribute.type === 'derived' ? '4,3' : 'none'}
	/>

	<!-- Oval -->
	<ellipse
		{cx}
		{cy}
		rx={ovalRx}
		ry={ovalRy}
		fill={colors.chenOvalFill}
		stroke={colors.chenOvalStroke}
		stroke-width={attribute.type === 'multivalued' ? 2.5 : 1.2}
		stroke-dasharray={attribute.type === 'derived' ? '4,3' : 'none'}
	/>

	{#if attribute.type === 'multivalued'}
		<ellipse
			{cx}
			{cy}
			rx={ovalRx - 4}
			ry={ovalRy - 4}
			fill="none"
			stroke={colors.chenOvalStroke}
			stroke-width="1"
		/>
	{/if}

	<!-- Attribute name -->
	<text
		x={cx}
		y={cy}
		text-anchor="middle"
		dominant-baseline="central"
		font-size="10"
		fill={colors.entityText}
		text-decoration={attribute.type === 'primary_key' ? 'underline' : 'none'}
		font-weight={attribute.type === 'primary_key' ? '600' : '400'}
	>
		{attribute.name}
	</text>
</g>
