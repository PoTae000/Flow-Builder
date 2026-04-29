<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { theme } from '$lib/stores/theme.svelte';

	const MINIMAP_W = 160;
	const MINIMAP_H = 120;
	const PADDING = 10;
	const EST_ENTITY_W = 160;
	const EST_ENTITY_H = 80;

	let draggingMinimap = $state(false);

	const bounds = $derived.by(() => {
		const entities = diagram.entities;
		if (entities.length === 0) {
			return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
		}
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const e of entities) {
			const x = e.position.x;
			const y = e.position.y;
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x + EST_ENTITY_W > maxX) maxX = x + EST_ENTITY_W;
			if (y + EST_ENTITY_H > maxY) maxY = y + EST_ENTITY_H;
		}
		// Add some margin so viewport rect is visible even at edges
		const mx = (maxX - minX) * 0.2 || 200;
		const my = (maxY - minY) * 0.2 || 150;
		return {
			minX: minX - mx,
			minY: minY - my,
			maxX: maxX + mx,
			maxY: maxY + my
		};
	});

	const scale = $derived(
		Math.min(
			(MINIMAP_W - PADDING * 2) / (bounds.maxX - bounds.minX),
			(MINIMAP_H - PADDING * 2) / (bounds.maxY - bounds.minY)
		)
	);

	const offsetX = $derived(
		PADDING + ((MINIMAP_W - PADDING * 2) - (bounds.maxX - bounds.minX) * scale) / 2
	);
	const offsetY = $derived(
		PADDING + ((MINIMAP_H - PADDING * 2) - (bounds.maxY - bounds.minY) * scale) / 2
	);

	function toMinimap(x: number, y: number) {
		return {
			x: (x - bounds.minX) * scale + offsetX,
			y: (y - bounds.minY) * scale + offsetY
		};
	}

	function fromMinimap(mx: number, my: number) {
		return {
			x: (mx - offsetX) / scale + bounds.minX,
			y: (my - offsetY) / scale + bounds.minY
		};
	}

	// Viewport rect in minimap coordinates
	const viewportW = $derived(typeof window !== 'undefined' ? window.innerWidth : 1200);
	const viewportH = $derived(typeof window !== 'undefined' ? window.innerHeight : 800);

	const viewportRect = $derived.by(() => {
		// The diagram canvas shows area from (-panX/zoom, -panY/zoom) with size (viewportW/zoom, viewportH/zoom)
		const vx = -diagram.panX / diagram.zoom;
		const vy = -diagram.panY / diagram.zoom;
		const vw = viewportW / diagram.zoom;
		const vh = viewportH / diagram.zoom;
		const topLeft = toMinimap(vx, vy);
		return {
			x: topLeft.x,
			y: topLeft.y,
			width: vw * scale,
			height: vh * scale
		};
	});

	const entityRects = $derived(
		diagram.entities.map((e) => {
			const pos = toMinimap(e.position.x, e.position.y);
			return {
				id: e.id,
				x: pos.x,
				y: pos.y,
				width: EST_ENTITY_W * scale,
				height: EST_ENTITY_H * scale,
				color: e.color || null
			};
		})
	);

	const colors = $derived(theme.colors);

	function panToMinimapPoint(clientX: number, clientY: number, svgEl: SVGSVGElement, smooth = false) {
		const rect = svgEl.getBoundingClientRect();
		const mx = clientX - rect.left;
		const my = clientY - rect.top;
		const diagramPoint = fromMinimap(mx, my);
		// Center the viewport on this point
		const newPanX = -(diagramPoint.x - viewportW / (2 * diagram.zoom)) * diagram.zoom;
		const newPanY = -(diagramPoint.y - viewportH / (2 * diagram.zoom)) * diagram.zoom;
		if (smooth) {
			diagram.smoothTransition = true;
			diagram.setPan(newPanX, newPanY);
			setTimeout(() => { diagram.smoothTransition = false; }, 300);
		} else {
			diagram.setPan(newPanX, newPanY);
		}
	}

	function handleMousedown(e: MouseEvent) {
		if (e.button !== 0) return;
		draggingMinimap = true;
		const svgEl = e.currentTarget as SVGSVGElement;
		// First click: smooth transition to clicked point
		panToMinimapPoint(e.clientX, e.clientY, svgEl, true);

		function handleMousemove(ev: MouseEvent) {
			if (!draggingMinimap) return;
			// While dragging: instant (smooth would lag)
			panToMinimapPoint(ev.clientX, ev.clientY, svgEl, false);
		}

		function handleMouseup() {
			draggingMinimap = false;
			window.removeEventListener('mousemove', handleMousemove);
			window.removeEventListener('mouseup', handleMouseup);
		}

		window.addEventListener('mousemove', handleMousemove);
		window.addEventListener('mouseup', handleMouseup);
	}
</script>

<div class="absolute bottom-3 right-3 z-10 hidden md:block">
	<div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-md">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<svg
			width={MINIMAP_W}
			height={MINIMAP_H}
			class="cursor-crosshair rounded-lg"
			onmousedown={handleMousedown}
		>
			<!-- Background -->
			<rect width={MINIMAP_W} height={MINIMAP_H} fill={colors.canvasBg} rx="8" />

			<!-- Entities -->
			{#each entityRects as er (er.id)}
				<rect
					x={er.x}
					y={er.y}
					width={Math.max(er.width, 2)}
					height={Math.max(er.height, 1.5)}
					fill={er.color || colors.entityHeaderFill}
					stroke={colors.entityStroke}
					stroke-width="0.5"
					rx="1"
				/>
			{/each}

			<!-- Viewport rectangle -->
			<rect
				x={viewportRect.x}
				y={viewportRect.y}
				width={viewportRect.width}
				height={viewportRect.height}
				fill="rgba(59, 130, 246, 0.15)"
				stroke="rgba(59, 130, 246, 0.6)"
				stroke-width="1"
				rx="1"
			/>
		</svg>
	</div>
</div>
