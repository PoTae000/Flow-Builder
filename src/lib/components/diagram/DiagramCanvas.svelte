<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { presentation } from '$lib/stores/presentation.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { getRenderer } from '$lib/renderers/index';
	import { getNearestConnectionPoints } from '$lib/utils/geometry';
	import type { ConnectionPoint, Rect } from '$lib/types/geometry';
	import EntityNode from './EntityNode.svelte';
	import RelationshipEdge from './RelationshipEdge.svelte';
	import ChenDiamond from './ChenDiamond.svelte';
	import ChenAttributeOval from './ChenAttributeOval.svelte';
	import FlowNodeShape from './FlowNodeShape.svelte';
	import FlowEdgeLine from './FlowEdgeLine.svelte';
	import DFDNodeShape from './DFDNodeShape.svelte';
	import DFDFlowLine from './DFDFlowLine.svelte';
	import RemoteCursor from './RemoteCursor.svelte';
	import ContextMenu from '../ui/ContextMenu.svelte';

	let svgEl: SVGSVGElement | undefined = $state();

	// A4: Responsive empty state
	let isMobile = $state(false);
	let resizeObserver: ResizeObserver | undefined;

	onMount(() => {
		const check = () => {
			isMobile = window.innerWidth < 768;
			updateCanvasSize();
		};

		check();
		window.addEventListener('resize', check);

		// ResizeObserver: track canvas size when layout changes (panel open/close)
		if (svgEl) {
			resizeObserver = new ResizeObserver(() => updateCanvasSize());
			resizeObserver.observe(svgEl);
		}

		// Register touch/wheel handlers with { passive: false } to allow preventDefault
		if (svgEl) {
			svgEl.addEventListener('wheel', handleWheel, { passive: false });
			svgEl.addEventListener('touchstart', handleTouchStart, { passive: false });
			svgEl.addEventListener('touchmove', handleTouchMove, { passive: false });
			svgEl.addEventListener('touchend', handleTouchEnd, { passive: false });
		}

		return () => {
			window.removeEventListener('resize', check);
			resizeObserver?.disconnect();
			if (svgEl) {
				svgEl.removeEventListener('wheel', handleWheel);
				svgEl.removeEventListener('touchstart', handleTouchStart);
				svgEl.removeEventListener('touchmove', handleTouchMove);
				svgEl.removeEventListener('touchend', handleTouchEnd);
			}
		};
	});

	function updateCanvasSize() {
		if (!svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		diagram.canvasWidth = rect.width;
		diagram.canvasHeight = rect.height;
	}

	// A6: Double-tap to zoom
	let lastTapTime = 0;

	// Drag state (supports multi-entity drag)
	let dragging = $state<{ offsets: Map<string, { dx: number; dy: number }>; startX: number; startY: number } | null>(null);
	let draggingNote = $state<{ noteId: string; dx: number; dy: number } | null>(null);
	let panning = $state<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);

	// Marquee selection state
	let selecting = $state<{ startX: number; startY: number; screenX: number; screenY: number } | null>(null);
	let selectCurrent = $state({ x: 0, y: 0 });

	// Touch state
	let touchState = $state<{
		type: 'pan' | 'drag' | 'pinch';
		startTouches?: { x: number; y: number }[];
		startDist?: number;
		startZoom?: number;
		entityId?: string;
		offsets?: Map<string, { dx: number; dy: number }>;
		panStartX?: number;
		panStartY?: number;
	} | null>(null);

	// Context menu state
	let contextMenu = $state<{ x: number; y: number } | null>(null);

	// Long-press timer for mobile context menu
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressStartPos: { x: number; y: number } | null = null;
	const LONG_PRESS_MS = 500;
	const LONG_PRESS_MOVE_THRESHOLD = 10;

	function closeContextMenu() {
		contextMenu = null;
	}

	function handleEntityContextMenu(nodeId: string, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		e.preventDefault();
		e.stopPropagation();

		if (!diagram.selectedNodeIds.includes(nodeId)) {
			diagram.selectEntity(nodeId);
		}

		contextMenu = { x: e.clientX, y: e.clientY };
	}

	function confirmDeleteSelected() {
		if (diagram.selectedNodeIds.length > 0) {
			const ids = [...diagram.selectedNodeIds];
			const count = ids.length;

			if (diagram.diagramType === 'er') {
				const hasRels = diagram.relationships.some(r =>
					ids.includes(r.entityIds[0]) || ids.includes(r.entityIds[1])
				);
				const msg = count === 1
					? `ลบ "${diagram.entities.find(e => e.id === ids[0])?.name}"${hasRels ? ' และความสัมพันธ์ที่เกี่ยวข้อง' : ''}?`
					: `ลบ ${count} เอนทิตี${hasRels ? ' และความสัมพันธ์ที่เกี่ยวข้อง' : ''}?`;
				dialog.confirm({ title: 'ยืนยันการลบ', message: msg, confirmText: 'ลบ', variant: 'danger' })
					.then(ok => { if (ok) diagram.removeEntities(ids); });
			} else if (diagram.diagramType === 'flowchart') {
				const msg = count === 1 ? `ลบ Node นี้?` : `ลบ ${count} Node?`;
				dialog.confirm({ title: 'ยืนยันการลบ', message: msg, confirmText: 'ลบ', variant: 'danger' })
					.then(ok => { if (ok) diagram.removeEntities(ids); });
			} else if (diagram.diagramType === 'context') {
				const msg = count === 1 ? `ลบ Node นี้?` : `ลบ ${count} Node?`;
				dialog.confirm({ title: 'ยืนยันการลบ', message: msg, confirmText: 'ลบ', variant: 'danger' })
					.then(ok => { if (ok) diagram.removeEntities(ids); });
			}
		}
	}

	function getContextMenuItems() {
		return [
			{ label: 'คัดลอก', icon: '\u{1F4CB}', action: () => { diagram.copySelected(); closeContextMenu(); } },
			{ label: 'วาง', icon: '\u{1F4CC}', action: () => { diagram.paste(); closeContextMenu(); } },
			{ label: 'ลบ', icon: '\u{1F5D1}\uFE0F', action: () => { confirmDeleteSelected(); closeContextMenu(); }, danger: true, divider: true }
		];
	}

	function clearLongPressTimer() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		longPressStartPos = null;
	}

	const marqueeRect = $derived.by(() => {
		if (!selecting) return null;
		const x = Math.min(selecting.startX, selectCurrent.x);
		const y = Math.min(selecting.startY, selectCurrent.y);
		return {
			x,
			y,
			width: Math.abs(selectCurrent.x - selecting.startX),
			height: Math.abs(selectCurrent.y - selecting.startY)
		};
	});

	const colors = $derived(theme.colors);
	const renderer = $derived(getRenderer(diagram.notation));

	// Compute entity rects
	const entityRects = $derived(
		new Map(diagram.entities.map((e) => [e.id, renderer.getEntityRect(e)]))
	);

	// Distribute connection points so lines sharing a side don't overlap
	function distributeConnectionPoints(
		relationships: typeof diagram.relationships,
		rects: Map<string, Rect>
	) {
		// Step 1: determine which side each relationship connects on each entity
		type SideInfo = { relId: string; entityId: string; otherEntityId: string; side: ConnectionPoint['side'] };
		const sideAssignments: SideInfo[] = [];
		const relPoints = new Map<string, { from: ConnectionPoint; to: ConnectionPoint; fromRect: Rect; toRect: Rect }>();

		for (const rel of relationships) {
			const fromRect = rects.get(rel.entityIds[0]);
			const toRect = rects.get(rel.entityIds[1]);
			if (!fromRect || !toRect) continue;
			const { from, to } = getNearestConnectionPoints(fromRect, toRect);
			relPoints.set(rel.id, { from, to, fromRect, toRect });
			sideAssignments.push({ relId: rel.id, entityId: rel.entityIds[0], otherEntityId: rel.entityIds[1], side: from.side });
			sideAssignments.push({ relId: rel.id, entityId: rel.entityIds[1], otherEntityId: rel.entityIds[0], side: to.side });
		}

		// Step 2: group by (entityId, side) and offset each connection
		const groups = new Map<string, SideInfo[]>();
		for (const info of sideAssignments) {
			const key = `${info.entityId}:${info.side}`;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(info);
		}

		const result: { relId: string; from: ConnectionPoint; to: ConnectionPoint; fromRect: Rect; toRect: Rect }[] = [];

		for (const rel of relationships) {
			const pts = relPoints.get(rel.id);
			if (!pts) continue;

			const fromKey = `${rel.entityIds[0]}:${pts.from.side}`;
			const toKey = `${rel.entityIds[1]}:${pts.to.side}`;
			const fromGroup = groups.get(fromKey) ?? [];
			const toGroup = groups.get(toKey) ?? [];

			const fromIdx = fromGroup.findIndex((s) => s.relId === rel.id);
			const toIdx = toGroup.findIndex((s) => s.relId === rel.id);

			const adjustedFrom = offsetPoint(pts.from, pts.fromRect, fromIdx, fromGroup.length);
			const adjustedTo = offsetPoint(pts.to, pts.toRect, toIdx, toGroup.length);

			result.push({ relId: rel.id, from: adjustedFrom, to: adjustedTo, fromRect: pts.fromRect, toRect: pts.toRect });
		}

		return result;
	}

	function offsetPoint(point: ConnectionPoint, rect: Rect, index: number, total: number): ConnectionPoint {
		if (total <= 1) return point;
		const spacing = 30; // wider spacing to separate lines clearly
		const totalSpan = (total - 1) * spacing;
		const offset = -totalSpan / 2 + index * spacing;
		const isHorizontal = point.side === 'top' || point.side === 'bottom';
		const maxOffset = (isHorizontal ? rect.width : rect.height) / 2 - 12;
		const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, offset));

		if (isHorizontal) {
			return { x: point.x + clampedOffset, y: point.y, side: point.side };
		} else {
			return { x: point.x, y: point.y + clampedOffset, side: point.side };
		}
	}

	// Compute relationship render data with distributed connection points
	const relationshipData = $derived.by(() => {
		const distributed = distributeConnectionPoints(diagram.relationships, entityRects);
		return distributed.map((d) => {
			const rel = diagram.relationships.find((r) => r.id === d.relId)!;
			return { relationship: rel, fromRect: d.fromRect, toRect: d.toRect, fromPoint: d.from, toPoint: d.to };
		});
	});

	// Presentation mode: filter what's visible
	const visibleEntities = $derived(
		presentation.active
			? diagram.entities.filter((e) => presentation.visibleEntityIds.has(e.id))
			: diagram.entities
	);
	const visibleRelData = $derived(
		presentation.active
			? relationshipData.filter((d) => presentation.visibleRelIds.has(d.relationship.id))
			: relationshipData
	);

	// Compute which sides of each entity have relationship connections (for Chen oval placement)
	const entityOccupiedSides = $derived.by(() => {
		const sides = new Map<string, string[]>();
		for (const d of relationshipData) {
			const fromId = d.relationship.entityIds[0];
			const toId = d.relationship.entityIds[1];
			if (!sides.has(fromId)) sides.set(fromId, []);
			if (!sides.has(toId)) sides.set(toId, []);
			sides.get(fromId)!.push(d.fromPoint.side);
			sides.get(toId)!.push(d.toPoint.side);
		}
		return sides;
	});

	// Remote cursors — uses dedicated cursorMap for reliable reactivity
	const remoteCursors = $derived(
		collab.connected ? [...collab.cursorMap.entries()] : []
	);

	function handleCursorMove(e: MouseEvent) {
		if (!collab.connected) return;
		const pos = screenToSvg(e.clientX, e.clientY);
		collab.updateCursor(pos.x, pos.y);
	}

	function handleCursorLeave() {
		if (!collab.connected) return;
		collab.clearCursor();
	}

	function screenToSvg(clientX: number, clientY: number) {
		if (!svgEl) return { x: 0, y: 0 };
		const rect = svgEl.getBoundingClientRect();
		return {
			x: (clientX - rect.left - diagram.panX) / diagram.zoom,
			y: (clientY - rect.top - diagram.panY) / diagram.zoom
		};
	}

	/** Get position of any node (entity, flow node, or DFD node) by id */
	function getNodePosition(id: string): { x: number; y: number } | null {
		if (diagram.diagramType === 'flowchart') {
			const n = diagram.flowNodes.find(n => n.id === id);
			return n ? n.position : null;
		} else if (diagram.diagramType === 'context') {
			const n = diagram.dfdNodes.find(n => n.id === id);
			return n ? n.position : null;
		}
		const ent = diagram.entityMap.get(id);
		return ent ? ent.position : null;
	}

	/** Move any node by id */
	function moveNode(id: string, pos: { x: number; y: number }) {
		if (diagram.diagramType === 'flowchart') {
			diagram.moveFlowNode(id, pos);
		} else if (diagram.diagramType === 'context') {
			diagram.moveDFDNode(id, pos);
		} else {
			diagram.moveEntity(id, pos);
		}
	}

	function handleEntityMouseDown(entityId: string, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		if (e.button === 0) {
			e.stopPropagation();

			// Determine selection
			if (e.shiftKey) {
				diagram.toggleEntitySelection(entityId);
				return;
			} else if (!diagram.selectedNodeIds.includes(entityId)) {
				// Clicking unselected node → select only this one
				diagram.selectEntity(entityId);
			}
			// If already selected (multi or single), keep selection and start dragging all

			const svgPos = screenToSvg(e.clientX, e.clientY);
			const ids = diagram.selectedNodeIds;
			const offsets = new Map<string, { dx: number; dy: number }>();
			for (const id of ids) {
				const pos = getNodePosition(id);
				if (pos) {
					offsets.set(id, {
						dx: svgPos.x - pos.x,
						dy: svgPos.y - pos.y
					});
				}
			}
			if (offsets.size > 0) {
				diagram.pushHistory();
				dragging = { offsets, startX: svgPos.x, startY: svgPos.y };
			}
		}
	}

	function handleEntityTouchStart(entityId: string, e: TouchEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		if (e.touches.length !== 1) return;
		e.stopPropagation();

		// Send touch as cursor for collab
		if (collab.connected) {
			const t = e.touches[0];
			const pos = screenToSvg(t.clientX, t.clientY);
			collab.updateCursor(pos.x, pos.y);
		}

		// A6: Double-tap to zoom
		const now = Date.now();
		if (now - lastTapTime < 300) {
			clearLongPressTimer();
			const pos = getNodePosition(entityId);
			if (pos) {
				const rect = svgEl?.getBoundingClientRect();
				if (rect) {
					diagram.setZoom(1.5);
					diagram.setPan(
						rect.width / 2 - pos.x * 1.5,
						rect.height / 2 - pos.y * 1.5
					);
				}
			}
			lastTapTime = 0;
			return;
		}
		lastTapTime = now;

		if (!diagram.selectedNodeIds.includes(entityId)) {
			diagram.selectEntity(entityId);
		}

		const touch = e.touches[0];
		const svgPos = screenToSvg(touch.clientX, touch.clientY);
		const ids = diagram.selectedNodeIds;
		const offsets = new Map<string, { dx: number; dy: number }>();
		for (const id of ids) {
			const pos = getNodePosition(id);
			if (pos) {
				offsets.set(id, {
					dx: svgPos.x - pos.x,
					dy: svgPos.y - pos.y
				});
			}
		}
		if (offsets.size > 0) {
			diagram.pushHistory();
			touchState = { type: 'drag', entityId, offsets };
		}

		// Start long-press timer for context menu
		longPressStartPos = { x: touch.clientX, y: touch.clientY };
		clearLongPressTimer();
		longPressTimer = setTimeout(() => {
			// Long-press triggered — show context menu
			if (typeof navigator !== 'undefined' && navigator.vibrate) {
				navigator.vibrate(50);
			}
			contextMenu = { x: touch.clientX, y: touch.clientY };
			// Cancel drag so the node doesn't keep moving
			touchState = null;
			longPressTimer = null;
			longPressStartPos = null;
		}, LONG_PRESS_MS);
	}

	function handleNoteMouseDown(noteId: string, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		if (e.button === 0) {
			e.stopPropagation();
			const svgPos = screenToSvg(e.clientX, e.clientY);
			const note = diagram.notes.find((n) => n.id === noteId);
			if (note) {
				diagram.pushHistory('Move note');
				draggingNote = {
					noteId,
					dx: svgPos.x - note.position.x,
					dy: svgPos.y - note.position.y
				};
			}
		}
	}

	// Inline note editing state
	let editingNoteId = $state<string | null>(null);
	let editingNoteText = $state('');

	function handleNoteDblClick(noteId: string) {
		if (collab.isViewer || diagram.viewOnly) return;
		const note = diagram.notes.find((n) => n.id === noteId);
		if (!note) return;
		editingNoteId = noteId;
		editingNoteText = note.text;
	}

	function commitNoteEdit() {
		if (editingNoteId && editingNoteText.trim() !== '') {
			diagram.updateNote(editingNoteId, editingNoteText.trim());
		}
		editingNoteId = null;
		editingNoteText = '';
	}

	function cancelNoteEdit() {
		editingNoteId = null;
		editingNoteText = '';
	}

	function handleCanvasMouseDown(e: MouseEvent) {
		closeContextMenu();
		if (diagram.viewOnly) {
			// Allow panning in view-only mode
			if (e.button === 0) {
				panning = {
					startX: e.clientX,
					startY: e.clientY,
					panStartX: diagram.panX,
					panStartY: diagram.panY
				};
			}
			return;
		}
		if (collab.isViewer) return;
		if (e.button === 0) {
			// Left-click on canvas: pan
			const target = e.target as Element;
			if (target.closest('.relationship-edge') || target.closest('.chen-diamond') || target.closest('.flow-edge') || target.closest('.dfd-flow')) return;

			diagram.clearSelection();
			panning = {
				startX: e.clientX,
				startY: e.clientY,
				panStartX: diagram.panX,
				panStartY: diagram.panY
			};
		} else if (e.button === 2) {
			// Right-click on canvas: start marquee selection
			const target = e.target as Element;
			if (target.closest('.relationship-edge') || target.closest('.chen-diamond') || target.closest('.flow-edge') || target.closest('.dfd-flow')) return;

			const svgPos = screenToSvg(e.clientX, e.clientY);
			selecting = { startX: svgPos.x, startY: svgPos.y, screenX: e.clientX, screenY: e.clientY };
			selectCurrent = { x: svgPos.x, y: svgPos.y };
		}
	}

	let rafId = 0;
	function handleMouseMove(e: MouseEvent) {
		cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			if (draggingNote) {
				const svgPos = screenToSvg(e.clientX, e.clientY);
				diagram.moveNote(draggingNote.noteId, {
					x: svgPos.x - draggingNote.dx,
					y: svgPos.y - draggingNote.dy
				});
			} else if (dragging) {
				let svgPos = screenToSvg(e.clientX, e.clientY);
				// Shift held: constrain to horizontal or vertical axis
				if (e.shiftKey) {
					const adx = Math.abs(svgPos.x - dragging.startX);
					const ady = Math.abs(svgPos.y - dragging.startY);
					if (adx >= ady) {
						svgPos = { x: svgPos.x, y: dragging.startY };
					} else {
						svgPos = { x: dragging.startX, y: svgPos.y };
					}
				}
				for (const [id, off] of dragging.offsets) {
					moveNode(id, {
						x: svgPos.x - off.dx,
						y: svgPos.y - off.dy
					});
				}
			} else if (panning) {
				diagram.setPan(
					panning.panStartX + (e.clientX - panning.startX),
					panning.panStartY + (e.clientY - panning.startY)
				);
			} else if (selecting) {
				const svgPos = screenToSvg(e.clientX, e.clientY);
				selectCurrent = { x: svgPos.x, y: svgPos.y };
			}
		});
	}

	function rectsOverlap(
		a: { x: number; y: number; width: number; height: number },
		b: { x: number; y: number; width: number; height: number }
	) {
		return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
	}

	function getNodeRect(node: { position: { x: number; y: number }; type?: string }) {
		const { x: cx, y: cy } = node.position;
		const type = node.type;
		// DFD external-entity is a circle r=40
		if (type === 'external-entity') return { x: cx - 40, y: cy - 40, width: 80, height: 80 };
		// DFD data-store
		if (type === 'data-store') return { x: cx - 70, y: cy - 20, width: 140, height: 40 };
		// DFD process
		if (type === 'process' && diagram.diagramType === 'context') return { x: cx - 60, y: cy - 25, width: 120, height: 50 };
		// Flowchart connector (circle r=25)
		if (type === 'connector') return { x: cx - 25, y: cy - 25, width: 50, height: 50 };
		// Flowchart default (140x60)
		return { x: cx - 70, y: cy - 30, width: 140, height: 60 };
	}

	function handleMouseUp(e: MouseEvent) {
		if (e.button === 0) {
			dragging = null;
			draggingNote = null;
			panning = null;
		} else if (e.button === 2 && selecting) {
			// Finish marquee selection
			const screenDist = Math.hypot(e.clientX - selecting.screenX, e.clientY - selecting.screenY);
			if (screenDist > 5 && marqueeRect) {
				const ids: string[] = [];

				if (diagram.diagramType === 'er') {
					for (const [id, eRect] of entityRects) {
						if (rectsOverlap(marqueeRect, eRect)) ids.push(id);
					}
				} else if (diagram.diagramType === 'flowchart') {
					for (const node of diagram.flowNodes) {
						if (rectsOverlap(marqueeRect, getNodeRect(node))) ids.push(node.id);
					}
				} else if (diagram.diagramType === 'context') {
					for (const node of diagram.dfdNodes) {
						if (rectsOverlap(marqueeRect, getNodeRect(node))) ids.push(node.id);
					}
				}

				diagram.selectEntities(ids);
			}
			selecting = null;
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		if (collab.isViewer && !diagram.viewOnly) return;
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		diagram.setZoom(diagram.zoom * delta);
	}

	// Touch handlers
	function handleTouchStart(e: TouchEvent) {
		// Send first touch as cursor for collab
		if (collab.connected && e.touches.length >= 1) {
			const t = e.touches[0];
			const pos = screenToSvg(t.clientX, t.clientY);
			collab.updateCursor(pos.x, pos.y);
		}
		if (collab.isViewer) return;
		// Only handle canvas touches (not entity touches which are handled separately)
		const target = e.target as Element;
		if (target.closest('.entity-node') || target.closest('.flow-node') || target.closest('.dfd-node')) return;

		if (e.touches.length === 1) {
			// Single finger on canvas → pan
			const touch = e.touches[0];
			diagram.clearSelection();
			touchState = {
				type: 'pan',
				startTouches: [{ x: touch.clientX, y: touch.clientY }],
				panStartX: diagram.panX,
				panStartY: diagram.panY
			};
		} else if (e.touches.length === 2) {
			// Two fingers → pinch zoom
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
			touchState = {
				type: 'pinch',
				startDist: dist,
				startZoom: diagram.zoom,
				startTouches: [
					{ x: t1.clientX, y: t1.clientY },
					{ x: t2.clientX, y: t2.clientY }
				],
				panStartX: diagram.panX,
				panStartY: diagram.panY
			};
		}
	}

	function handleTouchMove(e: TouchEvent) {
		// Cancel long-press if finger moves too much
		if (longPressStartPos && e.touches.length >= 1) {
			const t = e.touches[0];
			const dist = Math.hypot(t.clientX - longPressStartPos.x, t.clientY - longPressStartPos.y);
			if (dist > LONG_PRESS_MOVE_THRESHOLD) {
				clearLongPressTimer();
			}
		}

		if (!touchState) return;
		e.preventDefault();

		// Send touch position as cursor for collab
		if (collab.connected && e.touches.length >= 1) {
			const t = e.touches[0];
			const pos = screenToSvg(t.clientX, t.clientY);
			collab.updateCursor(pos.x, pos.y);
		}

		if (touchState.type === 'pan' && e.touches.length === 1) {
			const touch = e.touches[0];
			const start = touchState.startTouches![0];
			diagram.setPan(
				touchState.panStartX! + (touch.clientX - start.x),
				touchState.panStartY! + (touch.clientY - start.y)
			);
		} else if (touchState.type === 'drag' && e.touches.length === 1 && touchState.offsets) {
			const touch = e.touches[0];
			const svgPos = screenToSvg(touch.clientX, touch.clientY);
			for (const [id, off] of touchState.offsets) {
				moveNode(id, {
					x: svgPos.x - off.dx,
					y: svgPos.y - off.dy
				});
			}
		} else if (touchState.type === 'pinch' && e.touches.length === 2) {
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
			const scale = dist / touchState.startDist!;
			const newZoom = Math.max(0.1, Math.min(5, touchState.startZoom! * scale));
			diagram.setZoom(newZoom);
		} else if (touchState.type === 'pan' && e.touches.length === 2) {
			// Switched from pan to pinch
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
			touchState = {
				type: 'pinch',
				startDist: dist,
				startZoom: diagram.zoom,
				startTouches: [
					{ x: t1.clientX, y: t1.clientY },
					{ x: t2.clientX, y: t2.clientY }
				],
				panStartX: diagram.panX,
				panStartY: diagram.panY
			};
		}
	}

	function handleTouchEnd(_e: TouchEvent) {
		clearLongPressTimer();
		touchState = null;
		// Clear cursor when finger lifts
		if (collab.connected) {
			collab.clearCursor();
		}
	}

	export function getSvgElement(): SVGSVGElement | undefined {
		return svgEl;
	}

	export function fitToContent() {
		if (!svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		diagram.fitToContent(rect.width, rect.height);
	}
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={svgEl}
	class="w-full h-full touch-canvas"
	xmlns="http://www.w3.org/2000/svg"
	role="img"
	aria-label="ER Diagram Canvas"
	onmousedown={handleCanvasMouseDown}
	onmousemove={handleCursorMove}
	onmouseleave={handleCursorLeave}
	oncontextmenu={(e) => e.preventDefault()}
	style="background: {colors.canvasBg}; cursor: {dragging || draggingNote ? 'grabbing' : panning ? 'move' : selecting ? 'crosshair' : 'default'}; touch-action: none;"
>
	<!-- Defs: grid patterns + arrow markers -->
	<defs>
		<pattern id="grid-small" width="20" height="20" patternUnits="userSpaceOnUse">
			<path d="M 20 0 L 0 0 0 20" fill="none" stroke={colors.gridColor} stroke-width="0.5" />
		</pattern>
		<pattern id="grid-large" width="100" height="100" patternUnits="userSpaceOnUse">
			<rect width="100" height="100" fill="url(#grid-small)" />
			<path d="M 100 0 L 0 0 0 100" fill="none" stroke={colors.gridColorDark} stroke-width="1" />
		</pattern>

		<!-- Arrow markers -->
		<marker id="arrow-default" viewBox="0 0 10 6" refX="10" refY="3"
			markerWidth="8" markerHeight="6" orient="auto-start-reverse">
			<path d="M 0 0.5 L 10 3 L 0 5.5" fill="none" stroke={colors.relationshipStroke} stroke-width="1" stroke-linejoin="round" />
		</marker>
		<marker id="arrow-selected" viewBox="0 0 10 6" refX="10" refY="3"
			markerWidth="8" markerHeight="6" orient="auto-start-reverse">
			<path d="M 0 0.5 L 10 3 L 0 5.5" fill="none" stroke={colors.selectedStroke} stroke-width="1" stroke-linejoin="round" />
		</marker>
		<marker id="arrow-start-default" viewBox="0 0 10 6" refX="0" refY="3"
			markerWidth="8" markerHeight="6" orient="auto-start-reverse">
			<path d="M 10 0.5 L 0 3 L 10 5.5" fill="none" stroke={colors.relationshipStroke} stroke-width="1" stroke-linejoin="round" />
		</marker>
		<marker id="arrow-start-selected" viewBox="0 0 10 6" refX="0" refY="3"
			markerWidth="8" markerHeight="6" orient="auto-start-reverse">
			<path d="M 10 0.5 L 0 3 L 10 5.5" fill="none" stroke={colors.selectedStroke} stroke-width="1" stroke-linejoin="round" />
		</marker>
		<!-- Flowchart arrow -->
		<marker id="flow-arrow" viewBox="0 0 10 10" refX="10" refY="5"
			markerWidth="6" markerHeight="6" orient="auto-start-reverse">
			<path d="M 0 1 L 10 5 L 0 9" fill={colors.relationshipStroke} />
		</marker>
		<!-- DFD arrow -->
		<marker id="dfd-arrow" viewBox="0 0 10 10" refX="10" refY="5"
			markerWidth="6" markerHeight="6" orient="auto-start-reverse">
			<path d="M 0 1 L 10 5 L 0 9" fill={colors.relationshipStroke} />
		</marker>
	</defs>

	<!-- Background grid -->
	<rect class="canvas-bg" width="100%" height="100%" fill={diagram.showGrid ? 'url(#grid-large)' : colors.canvasBg} />

	<!-- Transform group for pan/zoom -->
	<g transform="translate({diagram.panX}, {diagram.panY}) scale({diagram.zoom})" font-family={diagram.diagramFont} style="will-change: transform;">
		{#if diagram.diagramType === 'er'}
			<!-- Relationships (drawn first, under entities) -->
			{#each visibleRelData as data}
				{#if renderer.useDiamond}
					<ChenDiamond
						relationship={data.relationship}
						fromPoint={data.fromPoint}
						toPoint={data.toPoint}
						{renderer}
						selected={diagram.selectedEdgeId === data.relationship.id}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(data.relationship.id); }}
					/>
				{:else}
					<RelationshipEdge
						relationship={data.relationship}
						fromPoint={data.fromPoint}
						toPoint={data.toPoint}
						fromRect={data.fromRect}
						toRect={data.toRect}
						{renderer}
						notation={diagram.notation}
						selected={diagram.selectedEdgeId === data.relationship.id}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(data.relationship.id); }}
					/>
				{/if}
			{/each}

			<!-- Chen attribute ovals -->
			{#if renderer.useOvalAttributes}
				{#each visibleEntities as entity}
					{@const rect = entityRects.get(entity.id)}
					{#if rect}
						{#each entity.attributes as attr, i}
							<ChenAttributeOval
								attribute={attr}
								entityRect={rect}
								entityId={entity.id}
								index={i}
								totalAttributes={entity.attributes.length}
								occupiedSides={entityOccupiedSides.get(entity.id) ?? []}
								{screenToSvg}
							/>
						{/each}
					{/if}
				{/each}
			{/if}

			<!-- Entities -->
			{#each visibleEntities as entity}
				{@const rect = entityRects.get(entity.id)}
				{#if rect}
					<EntityNode
						{entity}
						{rect}
						{renderer}
						selected={diagram.selectedNodeIds.includes(entity.id)}
						onmousedown={(e) => handleEntityMouseDown(entity.id, e)}
						onclick={() => { if (!collab.isViewer) diagram.selectEntity(entity.id); }}
						ontouchstart={(e) => handleEntityTouchStart(entity.id, e)}
						oncontextmenu={(e) => handleEntityContextMenu(entity.id, e)}
					/>
				{/if}
			{/each}

		{:else if diagram.diagramType === 'flowchart'}
			<!-- Flowchart edges -->
			{#each diagram.flowEdges as edge (edge.id)}
				{@const fromNode = diagram.flowNodes.find(n => n.id === edge.fromNodeId)}
				{@const toNode = diagram.flowNodes.find(n => n.id === edge.toNodeId)}
				{#if fromNode && toNode}
					<FlowEdgeLine
						{edge}
						{fromNode}
						{toNode}
						selected={diagram.selectedEdgeId === edge.id}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(edge.id); }}
					/>
				{/if}
			{/each}

			<!-- Flowchart nodes -->
			{#each diagram.flowNodes as node (node.id)}
				<FlowNodeShape
					{node}
					selected={diagram.selectedNodeIds.includes(node.id)}
					onmousedown={(e) => handleEntityMouseDown(node.id, e)}
					onclick={() => { if (!collab.isViewer) diagram.selectEntity(node.id); }}
					ontouchstart={(e) => handleEntityTouchStart(node.id, e)}
					oncontextmenu={(e) => handleEntityContextMenu(node.id, e)}
				/>
			{/each}

		{:else if diagram.diagramType === 'context'}
			<!-- DFD flows -->
			{#each diagram.dfdFlows as flow (flow.id)}
				{@const fromNode = diagram.dfdNodes.find(n => n.id === flow.fromNodeId)}
				{@const toNode = diagram.dfdNodes.find(n => n.id === flow.toNodeId)}
				{#if fromNode && toNode}
					<DFDFlowLine
						{flow}
						{fromNode}
						{toNode}
						selected={diagram.selectedEdgeId === flow.id}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(flow.id); }}
					/>
				{/if}
			{/each}

			<!-- DFD nodes -->
			{#each diagram.dfdNodes as node (node.id)}
				<DFDNodeShape
					{node}
					selected={diagram.selectedNodeIds.includes(node.id)}
					onmousedown={(e) => handleEntityMouseDown(node.id, e)}
					onclick={() => { if (!collab.isViewer) diagram.selectEntity(node.id); }}
					ontouchstart={(e) => handleEntityTouchStart(node.id, e)}
					oncontextmenu={(e) => handleEntityContextMenu(node.id, e)}
				/>
			{/each}
		{/if}

		<!-- Notes (alert-style) -->
		{#each diagram.notes as note}
			{@const noteW = 200}
			{@const charsPerLine = Math.floor((noteW - 24) / 7.5)}
			{@const wrappedLineCount = note.text.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)}
			{@const noteH = Math.max(40, 16 + wrappedLineCount * 18)}
			{@const c = theme.isDark
				? { bg: '#1e1e1e', border: '#555', text: '#e0e0e0', xBg: '#333', xStroke: '#aaa' }
				: { bg: '#ffffff', border: '#ccc', text: '#333333', xBg: '#f0f0f0', xStroke: '#666' }
			}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<g
				class="note-node"
				transform="translate({note.position.x}, {note.position.y})"
				onmousedown={(e) => handleNoteMouseDown(note.id, e)}
				ondblclick={() => handleNoteDblClick(note.id)}
				style="cursor: {draggingNote?.noteId === note.id ? 'grabbing' : 'grab'}"
			>
				<!-- Background -->
				<rect
					width={noteW}
					height={noteH}
					rx="5"
					fill={c.bg}
					stroke={c.border}
					stroke-width="1.5"
				/>
					<!-- Delete button (inside the box) -->
				{#if !diagram.viewOnly}
					<g
						class="note-delete"
						transform="translate({noteW - 18}, 4)"
						onclick={(e) => { e.stopPropagation(); diagram.removeNote(note.id); }}
						style="cursor: pointer"
					>
						<rect width="14" height="14" rx="3" fill={c.xBg} />
						<path d="M4 4 L10 10 M10 4 L4 10" stroke={c.xStroke} stroke-width="1.5" stroke-opacity="0.6" />
					</g>
				{/if}
				<!-- Inline edit or text display -->
				{#if editingNoteId === note.id}
					<foreignObject x="6" y="4" width={noteW - 12} height={Math.max(noteH - 8, 60)}>
						<!-- svelte-ignore a11y_autofocus -->
						<textarea
							autofocus
							class="note-edit-textarea"
							style="
								width: 100%;
								height: 100%;
								border: none;
								outline: none;
								resize: none;
								background: transparent;
								color: {c.text};
								font-size: 12px;
								font-family: {diagram.diagramFont};
								padding: 2px 4px;
								line-height: 18px;
								box-sizing: border-box;
							"
							bind:value={editingNoteText}
							onblur={commitNoteEdit}
							onkeydown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitNoteEdit(); }
								if (e.key === 'Escape') { cancelNoteEdit(); }
								e.stopPropagation();
							}}
							onmousedown={(e) => e.stopPropagation()}
						></textarea>
					</foreignObject>
				{:else}
					<foreignObject x="8" y="6" width={noteW - 28} height={noteH - 12}>
						<div
							style="
								width: 100%;
								height: 100%;
								font-size: 12px;
								font-family: {diagram.diagramFont};
								color: {c.text};
								line-height: 18px;
								word-wrap: break-word;
								overflow-wrap: break-word;
								white-space: pre-wrap;
								overflow: hidden;
								pointer-events: none;
							"
						>{note.text}</div>
					</foreignObject>
				{/if}
			</g>
		{/each}

		<!-- Marquee selection rectangle -->
		{#if marqueeRect && marqueeRect.width > 2}
			<rect
				x={marqueeRect.x}
				y={marqueeRect.y}
				width={marqueeRect.width}
				height={marqueeRect.height}
				fill="rgba(59, 130, 246, 0.08)"
				stroke="rgb(59, 130, 246)"
				stroke-width={1.5 / diagram.zoom}
				stroke-dasharray="{4 / diagram.zoom}"
			/>
		{/if}

		<!-- Remote cursors (collab) -->
		{#each remoteCursors as [clientId, cur] (clientId)}
			<RemoteCursor
				name={cur.name}
				color={cur.color}
				x={cur.x}
				y={cur.y}
				zoom={diagram.zoom}
			/>
		{/each}
	</g>

	<!-- Empty state -->
	{#if (diagram.diagramType === 'er' && diagram.entities.length === 0) ||
		(diagram.diagramType === 'flowchart' && diagram.flowNodes.length === 0) ||
		(diagram.diagramType === 'context' && diagram.dfdNodes.length === 0)}
		<text
			x="50%"
			y="50%"
			text-anchor="middle"
			dominant-baseline="central"
			font-size="16"
			fill={colors.attrText}
			font-family="'Kanit', sans-serif"
		>
			{#if diagram.diagramType === 'er'}
				{isMobile ? 'กดปุ่ม ☰ เพื่อเพิ่ม Entity' : 'เพิ่ม Entity จากแผงฟอร์มด้านซ้ายเพื่อเริ่มสร้าง ER Diagram'}
			{:else if diagram.diagramType === 'flowchart'}
				{isMobile ? 'กดปุ่ม ☰ เพื่อเพิ่ม Node' : 'เพิ่ม Node จากแผงฟอร์มด้านซ้ายเพื่อเริ่มสร้าง Flowchart'}
			{:else}
				{isMobile ? 'กดปุ่ม ☰ เพื่อเพิ่ม Node' : 'เพิ่ม Node จากแผงฟอร์มด้านซ้ายเพื่อเริ่มสร้าง Context Diagram'}
			{/if}
		</text>
	{/if}
</svg>

<!-- Context menu (HTML overlay on top of SVG) -->
{#if contextMenu}
	<ContextMenu
		x={contextMenu.x}
		y={contextMenu.y}
		items={getContextMenuItems()}
		onclose={closeContextMenu}
	/>
{/if}
