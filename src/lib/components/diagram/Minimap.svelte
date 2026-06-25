<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';
	import { theme } from '$lib/stores/theme.svelte';

	const MINIMAP_W = 160;
	const MINIMAP_H = 120;
	const PADDING = 10;
	const EST_ENTITY_W = 160;
	const EST_ENTITY_H = 80;

	let draggingMinimap = $state(false);

	// Get all nodes based on diagram type
	const allNodes = $derived.by(() => {
		if (diagram.diagramType === 'flowchart') {
			return diagram.flowNodes.map(n => ({
				id: n.id,
				x: n.position.x,
				y: n.position.y,
				w: n.type === 'connector' ? 50 : 140,
				h: n.type === 'connector' ? 50 : 60,
				color: n.color || null
			}));
		}
		if (diagram.diagramType === 'context') {
			return diagram.dfdNodes.map(n => ({
				id: n.id,
				x: n.position.x,
				y: n.position.y,
				w: n.type === 'external-entity' ? 120 : 140,
				h: n.type === 'data-store' ? 40 : n.type === 'process' ? (n.processNumber ? 78 : 50) : 50,
				color: n.color || null
			}));
		}
		return diagram.entities.map(e => ({
			id: e.id,
			x: e.position.x,
			y: e.position.y,
			w: EST_ENTITY_W,
			h: EST_ENTITY_H,
			color: e.color || null
		}));
	});

	const bounds = $derived.by(() => {
		if (allNodes.length === 0) {
			return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
		}
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const n of allNodes) {
			if (n.x < minX) minX = n.x;
			if (n.y < minY) minY = n.y;
			if (n.x + n.w > maxX) maxX = n.x + n.w;
			if (n.y + n.h > maxY) maxY = n.y + n.h;
		}
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

	const nodeRects = $derived(
		allNodes.map((n) => {
			const pos = toMinimap(n.x, n.y);
			return {
				id: n.id,
				x: pos.x,
				y: pos.y,
				width: n.w * scale,
				height: n.h * scale,
				color: n.color
			};
		})
	);

	const colors = $derived(theme.colors);

	function panToMinimapPoint(clientX: number, clientY: number, svgEl: SVGSVGElement, smooth = false) {
		const rect = svgEl.getBoundingClientRect();
		const mx = clientX - rect.left;
		const my = clientY - rect.top;
		const diagramPoint = fromMinimap(mx, my);
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
		panToMinimapPoint(e.clientX, e.clientY, svgEl, true);

		function handleMousemove(ev: MouseEvent) {
			if (!draggingMinimap) return;
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

<div class="minimap absolute bottom-3 right-3 z-10 hidden md:block">
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

			<!-- Nodes -->
			{#each nodeRects as nr (nr.id)}
				<rect
					x={nr.x}
					y={nr.y}
					width={Math.max(nr.width, 2)}
					height={Math.max(nr.height, 1.5)}
					fill={nr.color || colors.entityHeaderFill}
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
