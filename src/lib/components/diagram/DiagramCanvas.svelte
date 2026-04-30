<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { presentation } from '$lib/stores/presentation.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { highlight } from '$lib/stores/highlight.svelte';
	import { getRenderer } from '$lib/renderers/index';
	import { getNearestConnectionPoints } from '$lib/utils/geometry';
	import type { ConnectionPoint, Rect } from '$lib/types/geometry';
	import EntityNode from './EntityNode.svelte';
	import RelationshipEdge from './RelationshipEdge.svelte';
	import ChenDiamond from './ChenDiamond.svelte';
	import ChenAttributeOval from './ChenAttributeOval.svelte';
	import FlowNodeShape from './FlowNodeShape.svelte';
	import FlowConnectionHandles from './FlowConnectionHandles.svelte';
	import FlowEdgeLine from './FlowEdgeLine.svelte';
	import DFDNodeShape from './DFDNodeShape.svelte';
	import DFDFlowLine from './DFDFlowLine.svelte';
	import RemoteCursor from './RemoteCursor.svelte';
	import ContextMenu from '../ui/ContextMenu.svelte';
	import { i18n } from '$lib/i18n';
	import type { FlowEdge } from '$lib/types/flowchart';
	import type { DFDFlow } from '$lib/types/context-diagram';

	let svgEl: SVGSVGElement | undefined = $state();

	// Calculate edge offsets to prevent overlapping (for Flowchart)
	const flowEdgeOffsets = $derived.by(() => {
		const offsets = new Map<string, number>();
		const groups = new Map<string, FlowEdge[]>();

		// Group edges by from-to pair (DIRECTIONAL - same direction only)
		for (const edge of diagram.flowEdges) {
			// Use directional key: A→B is different from B→A
			const key = `${edge.fromNodeId}→${edge.toNodeId}`;

			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(edge);
		}

		// Assign offsets to parallel edges
		const OFFSET_STEP = 25; // pixels to offset each parallel edge (increased for better visibility)
		for (const [_key, edges] of groups) {
			if (edges.length === 1) {
				offsets.set(edges[0].id, 0); // Single edge, no offset
			} else {
				// Multiple parallel edges - spread them out symmetrically
				const half = (edges.length - 1) / 2;
				edges.forEach((edge, i) => {
					const offset = (i - half) * OFFSET_STEP;
					offsets.set(edge.id, offset);
				});
			}
		}

		return offsets;
	});

	// Calculate flow offsets to prevent overlapping (for DFD)
	const dfdFlowOffsets = $derived.by(() => {
		const offsets = new Map<string, number>();
		const groups = new Map<string, DFDFlow[]>();

		// Group flows by from-to pair (DIRECTIONAL - same direction only)
		for (const flow of diagram.dfdFlows) {
			// Use directional key: A→B is different from B→A
			const key = `${flow.fromNodeId}→${flow.toNodeId}`;

			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(flow);
		}

		// Assign offsets to parallel flows
		const OFFSET_STEP = 25; // Increased to match flowchart for consistency
		for (const [_key, flows] of groups) {
			if (flows.length === 1) {
				offsets.set(flows[0].id, 0);
			} else {
				const half = (flows.length - 1) / 2;
				flows.forEach((flow, i) => {
					const offset = (i - half) * OFFSET_STEP;
					offsets.set(flow.id, offset);
				});
			}
		}

		return offsets;
	});

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

	// Connection drag state (for drag-to-connect edges)
	let draggingConnection = $state<{ fromNodeId: string; fromSide: 'top' | 'right' | 'bottom' | 'left'; currentX: number; currentY: number } | null>(null);
	let hoveredNodeId = $state<string | null>(null);
	let hoveredFlowNodeId = $state<string | null>(null); // For showing connection handles on hover

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
		if (collab.isViewer || diagram.viewOnly || presentation.active) return;
		e.preventDefault();
		e.stopPropagation();

		if (!diagram.selectedNodeIdSet.has(nodeId)) {
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
					.then(ok => { if (ok) diagram.removeEntities(ids); }).catch(() => {});
			} else if (diagram.diagramType === 'flowchart') {
				const msg = count === 1 ? `ลบ Node นี้?` : `ลบ ${count} Node?`;
				dialog.confirm({ title: 'ยืนยันการลบ', message: msg, confirmText: 'ลบ', variant: 'danger' })
					.then(ok => { if (ok) for (const id of ids) diagram.removeFlowNode(id); }).catch(() => {});
			} else if (diagram.diagramType === 'context') {
				const msg = count === 1 ? `ลบ Node นี้?` : `ลบ ${count} Node?`;
				dialog.confirm({ title: 'ยืนยันการลบ', message: msg, confirmText: 'ลบ', variant: 'danger' })
					.then(ok => { if (ok) for (const id of ids) diagram.removeDFDNode(id); }).catch(() => {});
			}
		}
	}

	function getContextMenuItems() {
		const items: { label: string; action: () => void; danger?: boolean; divider?: boolean }[] = [
			{ label: 'คัดลอก', action: () => { diagram.copySelected(); closeContextMenu(); } },
			{ label: 'วาง', action: () => { diagram.paste(); closeContextMenu(); } },
		];

		// Lock/Unlock for ER entities
		if (diagram.diagramType === 'er' && diagram.selectedNodeIds.length > 0) {
			const allLocked = diagram.selectedNodeIds.every(id => diagram.entityMap.get(id)?.isLocked);
			items.push({
				label: allLocked ? 'ปลดล็อก' : 'ล็อกตำแหน่ง',
				action: () => {
					for (const id of diagram.selectedNodeIds) {
						diagram.updateEntity(id, { isLocked: !allLocked });
					}
					closeContextMenu();
				},
				divider: true
			});
		}

		items.push(
			{ label: 'ลบ', action: () => { confirmDeleteSelected(); closeContextMenu(); }, danger: true, divider: true }
		);
		return items;
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

	// Badge: entities with issues
	const orphanIds = $derived(new Set(
		diagram.entities
			.filter(e => !diagram.relationships.some(r => r.entityIds.includes(e.id)))
			.map(e => e.id)
	));
	const missingPkIds = $derived(new Set(
		diagram.entities
			.filter(e => !e.attributes.some(a => a.type === 'primary_key'))
			.map(e => e.id)
	));

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

	function handleStartConnection(nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', clientX: number, clientY: number) {
		if (collab.isViewer || diagram.viewOnly || presentation.active) return;
		const svgPos = screenToSvg(clientX, clientY);
		draggingConnection = {
			fromNodeId: nodeId,
			fromSide: side,
			currentX: svgPos.x,
			currentY: svgPos.y
		};
	}

	function handleEntityMouseDown(entityId: string, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly || presentation.active) return;
		if (e.button === 0) {
			e.stopPropagation();

			// Determine selection
			if (e.shiftKey) {
				diagram.toggleEntitySelection(entityId);
				return;
			} else if (!diagram.selectedNodeIdSet.has(entityId)) {
				// Clicking unselected node → select only this one
				diagram.selectEntity(entityId);
			}
			// If already selected (multi or single), keep selection and start dragging all

			const svgPos = screenToSvg(e.clientX, e.clientY);
			const ids = diagram.selectedNodeIds;
			const offsets = new Map<string, { dx: number; dy: number }>();
			for (const id of ids) {
				// Skip locked entities (allow select, block drag)
				if (diagram.diagramType === 'er') {
					const ent = diagram.entityMap.get(id);
					if (ent?.isLocked) continue;
				}
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
		if (collab.isViewer || diagram.viewOnly || presentation.active) return;
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

		if (!diagram.selectedNodeIdSet.has(entityId)) {
			diagram.selectEntity(entityId);
		}

		const touch = e.touches[0];
		const svgPos = screenToSvg(touch.clientX, touch.clientY);
		const ids = diagram.selectedNodeIds;
		const offsets = new Map<string, { dx: number; dy: number }>();
		for (const id of ids) {
			// Skip locked entities (allow select, block drag)
			if (diagram.diagramType === 'er') {
				const ent = diagram.entityMap.get(id);
				if (ent?.isLocked) continue;
			}
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
		if (collab.isViewer || diagram.viewOnly || presentation.active) return;
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

	// Inline entity name editing state
	let editingEntityId = $state<string | null>(null);
	let editingEntityName = $state('');

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

	function handleEntityDblClick(entityId: string) {
		if (collab.isViewer || diagram.viewOnly || presentation.active) return;
		const entity = diagram.entities.find((e) => e.id === entityId);
		if (!entity) return;
		editingEntityId = entityId;
		editingEntityName = entity.name;
	}

	function commitEntityEdit() {
		if (editingEntityId && editingEntityName.trim() !== '') {
			diagram.updateEntity(editingEntityId, { name: editingEntityName.trim() });
		}
		editingEntityId = null;
		editingEntityName = '';
	}

	function cancelEntityEdit() {
		editingEntityId = null;
		editingEntityName = '';
	}

	function handleCanvasMouseDown(e: MouseEvent) {
		closeContextMenu();
		if (presentation.active) return; // Block all canvas interaction during presentation
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

				// Snap to nearby entities (edge/center alignment)
				const SNAP_THRESHOLD = 5;
				let snapDx = 0;
				let snapDy = 0;

				if (dragging.offsets.size === 1 && diagram.diagramType === 'er') {
					const [dragId] = dragging.offsets.keys();
					const off = dragging.offsets.get(dragId)!;
					const draggedRect = entityRects.get(dragId);
					if (draggedRect) {
						const newX = svgPos.x - off.dx;
						const newY = svgPos.y - off.dy;
						const dCx = newX + draggedRect.width / 2;
						const dCy = newY + draggedRect.height / 2;
						const dEdges = { l: newX, r: newX + draggedRect.width, t: newY, b: newY + draggedRect.height, cx: dCx, cy: dCy };

						for (const [eid, eRect] of entityRects) {
							if (eid === dragId) continue;
							const oEdges = { l: eRect.x, r: eRect.x + eRect.width, t: eRect.y, b: eRect.y + eRect.height, cx: eRect.x + eRect.width / 2, cy: eRect.y + eRect.height / 2 };

							// Vertical (x-axis) alignment
							for (const [dv, ov] of [[dEdges.l, oEdges.l], [dEdges.r, oEdges.r], [dEdges.cx, oEdges.cx], [dEdges.l, oEdges.r], [dEdges.r, oEdges.l]]) {
								if (Math.abs(dv - ov) <= SNAP_THRESHOLD) {
									snapDx = ov - dv;
								}
							}

							// Horizontal (y-axis) alignment
							for (const [dv, ov] of [[dEdges.t, oEdges.t], [dEdges.b, oEdges.b], [dEdges.cy, oEdges.cy], [dEdges.t, oEdges.b], [dEdges.b, oEdges.t]]) {
								if (Math.abs(dv - ov) <= SNAP_THRESHOLD) {
									snapDy = ov - dv;
								}
							}
						}
					}
				}

				for (const [id, off] of dragging.offsets) {
					moveNode(id, {
						x: svgPos.x - off.dx + snapDx,
						y: svgPos.y - off.dy + snapDy
					});
				}
			} else if (draggingConnection) {
				const svgPos = screenToSvg(e.clientX, e.clientY);
				draggingConnection.currentX = svgPos.x;
				draggingConnection.currentY = svgPos.y;

				// Check if hovering over a different node
				hoveredNodeId = null;
				if (diagram.diagramType === 'flowchart') {
					for (const node of diagram.flowNodes) {
						if (node.id === draggingConnection.fromNodeId) continue;
						const { position } = node;
						const W = 140;
						const H = 60;
						if (
							svgPos.x >= position.x - W / 2 &&
							svgPos.x <= position.x + W / 2 &&
							svgPos.y >= position.y - H / 2 &&
							svgPos.y <= position.y + H / 2
						) {
							hoveredNodeId = node.id;
							break;
						}
					}
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
			// Handle connection drop
			if (draggingConnection && hoveredNodeId && diagram.diagramType === 'flowchart') {
				diagram.addFlowEdge('', draggingConnection.fromNodeId, hoveredNodeId);
			}
			dragging = null;
			draggingNote = null;
			panning = null;
			draggingConnection = null;
			hoveredNodeId = null;
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
		if (presentation.active) return;
		e.preventDefault();
		if (collab.isViewer && !diagram.viewOnly) return;
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		diagram.setZoom(diagram.zoom * delta);
	}

	// Touch handlers
	function handleTouchStart(e: TouchEvent) {
		if (presentation.active) return;
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
		if (presentation.active) return;
		// Cancel long-press on any movement during drag (prevents context menu while dragging)
		if (longPressTimer && touchState?.type === 'drag') {
			clearLongPressTimer();
		} else if (longPressStartPos && e.touches.length >= 1) {
			// For non-drag touches, use distance threshold
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
		if (presentation.active) return;
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
		diagram.smoothFitToContent(rect.width, rect.height);
	}
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={svgEl}
	data-onboarding="canvas"
	class="w-full h-full touch-canvas"
	xmlns="http://www.w3.org/2000/svg"
	role="img"
	aria-label="ER Diagram Canvas"
	onmousedown={handleCanvasMouseDown}
	onmousemove={handleCursorMove}
	onmouseleave={handleCursorLeave}
	oncontextmenu={(e) => e.preventDefault()}
	style="background: {colors.canvasBg}; cursor: {dragging || draggingNote ? 'grabbing' : panning ? 'move' : selecting ? 'crosshair' : 'default'}; touch-action: {presentation.active ? 'auto' : 'none'}; {presentation.active ? 'pointer-events: none;' : ''}"
>
	<!-- Defs: grid patterns + arrow markers -->
	<defs>
		<pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
			<circle cx="10" cy="10" r="0.8" fill={colors.gridColorDark} />
		</pattern>
		<pattern id="grid-large" width="100" height="100" patternUnits="userSpaceOnUse">
			<rect width="100" height="100" fill="url(#grid-dots)" />
			<circle cx="0" cy="0" r="1.5" fill={colors.gridColorDark} />
			<circle cx="100" cy="0" r="1.5" fill={colors.gridColorDark} />
			<circle cx="0" cy="100" r="1.5" fill={colors.gridColorDark} />
			<circle cx="100" cy="100" r="1.5" fill={colors.gridColorDark} />
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
		<!-- Temporary connection arrows -->
		<marker id="arrow-temp" viewBox="0 0 10 10" refX="10" refY="5"
			markerWidth="6" markerHeight="6" orient="auto-start-reverse">
			<path d="M 0 1 L 10 5 L 0 9" fill="#3b82f6" />
		</marker>
		<marker id="arrow-temp-valid" viewBox="0 0 10 10" refX="10" refY="5"
			markerWidth="6" markerHeight="6" orient="auto-start-reverse">
			<path d="M 0 1 L 10 5 L 0 9" fill="#10b981" />
		</marker>
	</defs>

	<!-- Background grid -->
	<rect class="canvas-bg" width="100%" height="100%" fill={diagram.showGrid ? 'url(#grid-large)' : colors.canvasBg} />

	<!-- Transform group for pan/zoom -->
	<g transform="translate({diagram.panX}, {diagram.panY}) scale({diagram.zoom})" font-family={diagram.diagramFont} style="will-change: transform;{diagram.smoothTransition ? ' transition: transform 0.3s ease-out;' : ''}">
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
						highlighted={highlight.active && highlight.relationshipIds.has(data.relationship.id)}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(data.relationship.id); }}
						animateIn={(presentation.active && presentation.newlyRevealedRelIds.has(data.relationship.id)) || diagram.newRelationshipIds.has(data.relationship.id)}
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
						highlighted={highlight.active && highlight.relationshipIds.has(data.relationship.id)}
						dimmed={diagram.focusMode && diagram.focusedRelIds != null && !diagram.focusedRelIds.has(data.relationship.id)}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(data.relationship.id); }}
						animateIn={(presentation.active && presentation.newlyRevealedRelIds.has(data.relationship.id)) || diagram.newRelationshipIds.has(data.relationship.id)}
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
						selected={diagram.selectedNodeIdSet.has(entity.id)}
						highlighted={highlight.active && highlight.entityIds.has(entity.id)}
						missingPk={missingPkIds.has(entity.id)}
						isOrphan={orphanIds.has(entity.id)}
						dimmed={diagram.focusMode && diagram.focusedEntityIds != null && !diagram.focusedEntityIds.has(entity.id)}
						onmousedown={(e) => handleEntityMouseDown(entity.id, e)}
						onclick={(e) => { if (!collab.isViewer && !e.shiftKey) diagram.selectEntity(entity.id); }}
						ontouchstart={(e) => handleEntityTouchStart(entity.id, e)}
						oncontextmenu={(e) => handleEntityContextMenu(entity.id, e)}
						ondblclick={() => handleEntityDblClick(entity.id)}
						animateIn={(presentation.active && presentation.newlyRevealedEntityIds.has(entity.id)) || diagram.newEntityIds.has(entity.id)}
						dragging={dragging != null && dragging.offsets.has(entity.id)}
					/>
					<!-- Inline entity name editing -->
					{#if editingEntityId === entity.id}
						<foreignObject
							x={rect.x + 2}
							y={rect.y + 2}
							width={rect.width - 4}
							height={renderer.headerHeight - 4}
						>
							<!-- svelte-ignore a11y_autofocus -->
							<input
								autofocus
								type="text"
								style="
									width: 100%;
									height: 100%;
									border: 1px solid #3b82f6;
									outline: none;
									background: {colors.entityFill};
									color: {colors.entityHeaderText};
									font-size: 14px;
									font-weight: 700;
									font-family: {diagram.diagramFont};
									text-align: center;
									padding: 0 4px;
									box-sizing: border-box;
									border-radius: 2px;
								"
								bind:value={editingEntityName}
								onblur={commitEntityEdit}
								onkeydown={(e) => {
									if (e.key === 'Enter') { e.preventDefault(); commitEntityEdit(); }
									if (e.key === 'Escape') { cancelEntityEdit(); }
									e.stopPropagation();
								}}
								onmousedown={(e) => e.stopPropagation()}
								ondblclick={(e) => e.stopPropagation()}
							/>
						</foreignObject>
					{/if}
				{/if}
			{/each}

			<!-- Dying entities (fade-out ghosts) -->
			{#each diagram.dyingEntities as entity (entity.id)}
				{@const rect = entity._dyingRect ?? { x: entity.position.x, y: entity.position.y, width: 160, height: 80 }}
				<g class="dying-entity" style="transform-origin: {rect.x + rect.width / 2}px {rect.y + rect.height / 2}px;">
					<rect
						x={rect.x}
						y={rect.y}
						width={rect.width}
						height={rect.height}
						fill={entity.color || colors.entityFill}
						stroke={colors.entityStroke}
						stroke-width="1.5"
						opacity="0.5"
					/>
					<text
						x={rect.x + rect.width / 2}
						y={rect.y + rect.height / 2}
						text-anchor="middle"
						dominant-baseline="central"
						fill={colors.entityHeaderText}
						font-size="14"
						font-weight="700"
						opacity="0.5"
					>{entity.name}</text>
				</g>
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
						offset={flowEdgeOffsets.get(edge.id) ?? 0}
						selected={diagram.selectedEdgeId === edge.id}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(edge.id); }}
					/>
				{/if}
			{/each}

			<!-- Flowchart nodes -->
			{#each diagram.flowNodes as node (node.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					onmouseenter={() => hoveredFlowNodeId = node.id}
					onmouseleave={() => hoveredFlowNodeId = null}
				>
					<FlowNodeShape
						{node}
						selected={diagram.selectedNodeIdSet.has(node.id)}
						onmousedown={(e) => handleEntityMouseDown(node.id, e)}
						onclick={(e) => { if (!collab.isViewer && !e.shiftKey) diagram.selectEntity(node.id); }}
						ontouchstart={(e) => handleEntityTouchStart(node.id, e)}
						oncontextmenu={(e) => handleEntityContextMenu(node.id, e)}
						animateIn={(presentation.active && presentation.newlyRevealedEntityIds.has(node.id)) || diagram.newEntityIds.has(node.id)}
					/>

					<!-- Connection handles (show only on hover) -->
					{#if hoveredFlowNodeId === node.id && !dragging && !panning && !draggingConnection && !collab.isViewer && !diagram.viewOnly && !presentation.active}
						<FlowConnectionHandles
							{node}
							onStartConnection={handleStartConnection}
						/>
					{/if}
				</g>
			{/each}

			<!-- Temporary connection line while dragging -->
			{#if draggingConnection}
				{@const fromNode = diagram.flowNodes.find(n => n.id === draggingConnection!.fromNodeId)}
				{#if fromNode}
					{@const W = 140}
					{@const H = 60}
					{@const startPos = draggingConnection!.fromSide === 'top' ? { x: fromNode.position.x, y: fromNode.position.y - H / 2 } :
						draggingConnection!.fromSide === 'bottom' ? { x: fromNode.position.x, y: fromNode.position.y + H / 2 } :
						draggingConnection!.fromSide === 'left' ? { x: fromNode.position.x - W / 2, y: fromNode.position.y } :
						{ x: fromNode.position.x + W / 2, y: fromNode.position.y }}
					<line
						x1={startPos.x}
						y1={startPos.y}
						x2={draggingConnection!.currentX}
						y2={draggingConnection!.currentY}
						stroke={hoveredNodeId ? '#10b981' : '#3b82f6'}
						stroke-width="2"
						stroke-dasharray="6 4"
						opacity="0.7"
						marker-end={hoveredNodeId ? 'url(#arrow-temp-valid)' : 'url(#arrow-temp)'}
					/>
				{/if}
			{/if}

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
						offset={dfdFlowOffsets.get(flow.id) ?? 0}
						selected={diagram.selectedEdgeId === flow.id}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(flow.id); }}
					/>
				{/if}
			{/each}

			<!-- DFD nodes -->
			{#each diagram.dfdNodes as node (node.id)}
				<DFDNodeShape
					{node}
					selected={diagram.selectedNodeIdSet.has(node.id)}
					onmousedown={(e) => handleEntityMouseDown(node.id, e)}
					onclick={(e) => { if (!collab.isViewer && !e.shiftKey) diagram.selectEntity(node.id); }}
					ontouchstart={(e) => handleEntityTouchStart(node.id, e)}
					oncontextmenu={(e) => handleEntityContextMenu(node.id, e)}
					animateIn={(presentation.active && presentation.newlyRevealedEntityIds.has(node.id)) || diagram.newEntityIds.has(node.id)}
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
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
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
		<g transform="translate({diagram.canvasWidth / 2}, {diagram.canvasHeight / 2})">
		<g class="empty-state">
			<!-- Icon -->
			<g transform="translate(-20, -48)" opacity="0.3">
				<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={colors.attrText}>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
				</svg>
			</g>
			<!-- Title -->
			<text
				y="12"
				text-anchor="middle"
				font-size="16"
				fill={colors.attrText}
				opacity="0.6"
				font-family="'Kanit', sans-serif"
			>
				{#if diagram.diagramType === 'er'}
					{isMobile ? i18n.t('canvas.empty.er.title') : i18n.t('canvas.empty.er.title')}
				{:else if diagram.diagramType === 'flowchart'}
					{isMobile ? i18n.t('canvas.empty.flow.title') : i18n.t('canvas.empty.flow.title')}
				{:else}
					{isMobile ? i18n.t('canvas.empty.dfd.title') : i18n.t('canvas.empty.dfd.title')}
				{/if}
			</text>
			<!-- Description -->
			{#if !isMobile}
				<text
					y="34"
					text-anchor="middle"
					font-size="13"
					fill={colors.attrText}
					opacity="0.4"
					font-family="'Kanit', sans-serif"
				>
					{#if diagram.diagramType === 'er'}
						{i18n.t('canvas.empty.er.desc')}
					{:else if diagram.diagramType === 'flowchart'}
						{i18n.t('canvas.empty.flow.desc')}
					{:else}
						{i18n.t('canvas.empty.dfd.desc')}
					{/if}
				</text>
			{/if}
		</g>
		</g>
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

<style>
	@keyframes entityDie {
		from { opacity: 0.5; transform: scale(1); }
		to { opacity: 0; transform: scale(0.8); }
	}
	.dying-entity {
		animation: entityDie 0.3s ease-in forwards;
		pointer-events: none;
	}
	@keyframes emptyStateIn {
		from { opacity: 0; transform: translate(0, 12px); }
		to { opacity: 1; transform: translate(0, 0); }
	}
	.empty-state {
		animation: emptyStateIn 0.5s ease-out;
	}
</style>
