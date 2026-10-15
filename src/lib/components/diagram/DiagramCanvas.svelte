<script lang="ts">
 import { anchorPoint } from '$lib/utils/er-ports';
	import { flowNodeFontSize, flowNodeFontWeight } from '$lib/utils/flow-node-size';
 import type { Position } from '$lib/types/geometry';
 import FlowEdgeTools from './FlowEdgeTools.svelte';
	import { snapFlowSegment } from '$lib/utils/flow-segment-snap';
	import { onMount, onDestroy, tick } from 'svelte';
	import { placeERShape } from '$lib/utils/er-palette';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { collab } from '$lib/stores/collab.svelte';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { highlight } from '$lib/stores/highlight.svelte';
	import { getRenderer } from '$lib/renderers/index';
	import { getNearestConnectionPoints } from '$lib/utils/geometry';
	import { nodeSizeForText } from '$lib/utils/text-measure';
	import {
		getFlowPort,
		getFlowEdgeRoute,
		resolveFlowSides,
		routeFromPortToPoint,
		nearestSide,
		computeFlowPorts,
		type Side,
		type FlowPortInfo
	} from '$lib/utils/flow-routing';
	import type { ConnectionPoint, Rect } from '$lib/types/geometry';
	import EntityNode from './EntityNode.svelte';
	import RelationshipEdge from './RelationshipEdge.svelte';
	import ChenDiamond from './ChenDiamond.svelte';
	import ChenAttributeOval from './ChenAttributeOval.svelte';
	import FlowNodeShape from './FlowNodeShape.svelte';
	import FlowConnectionHandles from './FlowConnectionHandles.svelte';
	import { nearestAnchor as nearestERAnchor } from '$lib/utils/er-ports';
	import FlowEdgeLine from './FlowEdgeLine.svelte';
	import InlineTextEditor from './InlineTextEditor.svelte';
	import InNodeTextEditor from './InNodeTextEditor.svelte';
	import ResizeHandles from './ResizeHandles.svelte';
	import WaypointHandles from './WaypointHandles.svelte';
	import CommentBadge from './CommentBadge.svelte';
	import DFDNodeShape from './DFDNodeShape.svelte';
	import DFDFlowLine from './DFDFlowLine.svelte';
	import RemoteCursor from './RemoteCursor.svelte';
	import DataFlowParticles from './DataFlowParticles.svelte';
	import type { PathData } from './DataFlowParticles.svelte';
	import { flowSim } from '$lib/stores/flow-sim.svelte';
	import ContextMenu from '../ui/ContextMenu.svelte';
	import type { MenuItem } from '../ui/ContextMenu.svelte';
	import { i18n } from '$lib/i18n';
	import { createOrthogonalPath } from '$lib/renderers/shared/svg-utils';
	import type { CardinalityType } from '$lib/types/er';
	import type { FlowEdge, FlowNode, FlowNodeType } from '$lib/types/flowchart';
	import type { DFDFlow, DFDNode } from '$lib/types/context-diagram';

	let svgEl: SVGSVGElement | undefined = $state();


	let ripples = $state<Array<{ id: number; x: number; y: number }>>([]);
	let rippleId = 0;

	function addRipple(x: number, y: number) {
		if (ripples.length >= 5) ripples = ripples.slice(1);
		ripples = [...ripples, { id: ++rippleId, x, y }];
	}
	function removeRipple(id: number) {
		ripples = ripples.filter(r => r.id !== id);
	}


	let prevEntityCount = $state(0);
	$effect(() => {
		const currentCount = diagram.diagramType === 'er'
			? diagram.entities.length
			: diagram.diagramType === 'flowchart'
				? diagram.flowNodes.length
				: diagram.dfdNodes.length;

		if (currentCount > prevEntityCount && prevEntityCount > 0) {

			let pos: { x: number; y: number } | null = null;
			if (diagram.diagramType === 'er' && diagram.entities.length > 0) {
				pos = diagram.entities[diagram.entities.length - 1].position;
			} else if (diagram.diagramType === 'flowchart' && diagram.flowNodes.length > 0) {
				pos = diagram.flowNodes[diagram.flowNodes.length - 1].position;
			} else if (diagram.diagramType === 'context' && diagram.dfdNodes.length > 0) {
				pos = diagram.dfdNodes[diagram.dfdNodes.length - 1].position;
			}
			if (pos) addRipple(pos.x, pos.y);
		}
		prevEntityCount = currentCount;
	});


	$effect(() => {

		void diagram.entities.length;
		void diagram.relationships.length;
		void diagram.flowNodes.length;
		void diagram.flowEdges.length;
		void diagram.dfdNodes.length;
		void diagram.dfdFlows.length;

		if (diagram.physicsMode) {
			diagram.physicsSyncBodies();
		}
	});


	const flowEdgeOffsets = $derived.by(() => {
		const offsets = new Map<string, number>();
		const groups = new Map<string, FlowEdge[]>();


		for (const edge of diagram.flowEdges) {

			const key = `${edge.fromNodeId}→${edge.toNodeId}`;

			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(edge);
		}


		const OFFSET_STEP = 40;
		for (const [_key, edges] of groups) {
			if (edges.length === 1) {
				offsets.set(edges[0].id, 0);
			} else {

				const half = (edges.length - 1) / 2;
				edges.forEach((edge, i) => {
					const offset = (i - half) * OFFSET_STEP;
					offsets.set(edge.id, offset);
				});
			}
		}

		return offsets;
	});




	const flowPorts = $derived.by<Map<string, FlowPortInfo>>(() => {
		if (diagram.diagramType !== 'flowchart') return new Map();
		return computeFlowPorts(diagram.flowEdges, diagram.flowNodes);
	});


	function getDFDNodeRect(node: DFDNode): { x: number; y: number; w: number; h: number } {
		const cx = node.position.x, cy = node.position.y;
		if (node.type === 'process') {
			const w = node.width ?? 140, h = node.height ?? ((node.processNumber ? 28 : 0) + 50);
			return { x: cx - w / 2, y: cy - h / 2, w, h };
		} else if (node.type === 'external-entity') {
			const w = node.width ?? 120, h = node.height ?? 50;
			return { x: cx - w / 2, y: cy - h / 2, w, h };
		} else {
			const w = node.width ?? 140, h = node.height ?? 40;
			return { x: cx - w / 2, y: cy - h / 2, w, h };
		}
	}

	type DFDDir = 'top' | 'bottom' | 'left' | 'right';
	function dfdNaturalDir(fx: number, fy: number, tx: number, ty: number, nodeType: string): DFDDir {
		const dx = tx - fx, dy = ty - fy;
		if (nodeType === 'data-store') return dy >= 0 ? 'bottom' : 'top';
		if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
		return dy > 0 ? 'bottom' : 'top';
	}
	function dfdGetPort(dir: DFDDir, rect: { x: number; y: number; w: number; h: number }, cx: number, cy: number, offset?: number) {
		const off = offset || 0;
		switch (dir) {
			case 'right': return { x: rect.x + rect.w, y: Math.max(rect.y, Math.min(rect.y + rect.h, cy + off)) };
			case 'left': return { x: rect.x, y: Math.max(rect.y, Math.min(rect.y + rect.h, cy + off)) };
			case 'bottom': return { x: Math.max(rect.x, Math.min(rect.x + rect.w, cx + off)), y: rect.y + rect.h };
			case 'top': return { x: Math.max(rect.x, Math.min(rect.x + rect.w, cx + off)), y: rect.y };
		}
	}

	function getDFDFlowRoute(flow: DFDFlow, fromNode: DFDNode, toNode: DFDNode): { x: number; y: number }[] {
		const fromRect = getDFDNodeRect(fromNode);
		const toRect = getDFDNodeRect(toNode);
		const fcx = fromNode.position.x, fcy = fromNode.position.y;
		const tcx = toNode.position.x, tcy = toNode.position.y;



		const auto = diagram.dfdFlowPortOffsets.get(flow.id);
		const fromDir = flow.fromSide || auto?.fromSide || dfdNaturalDir(fcx, fcy, tcx, tcy, fromNode.type);
		const toDir = flow.toSide || auto?.toSide || dfdNaturalDir(tcx, tcy, fcx, fcy, toNode.type);
		const fromOff = flow.fromPortOffset ?? auto?.from;
		const toOff = flow.toPortOffset ?? auto?.to;
		const p1 = dfdGetPort(fromDir, fromRect, fcx, fcy, fromOff);
		const p4 = dfdGetPort(toDir, toRect, tcx, tcy, toOff);

		const sH = fromDir === 'left' || fromDir === 'right';
		const eH = toDir === 'left' || toDir === 'right';
		const wp = flow.waypoints?.[0];

		let p2: { x: number; y: number }, p3: { x: number; y: number };

		if (wp) {

			if (sH) {
				p2 = { x: wp.x, y: p1.y }; p3 = { x: wp.x, y: p4.y };
			} else {
				p2 = { x: p1.x, y: wp.y }; p3 = { x: p4.x, y: wp.y };
			}
		} else {

			if (sH && eH) {
				const midX = (p1.x + p4.x) / 2 + (auto?.routeOffset ?? 0);
				p2 = { x: midX, y: p1.y }; p3 = { x: midX, y: p4.y };
			} else if (!sH && !eH) {
				const midY = (p1.y + p4.y) / 2 + (auto?.routeOffset ?? 0);
				p2 = { x: p1.x, y: midY }; p3 = { x: p4.x, y: midY };
			} else if (sH && !eH) {
				p2 = { x: p4.x, y: p1.y }; p3 = p2;
			} else {
				p2 = { x: p1.x, y: p4.y }; p3 = p2;
			}

			const GAP = 30;
			if ((fromDir === 'top' && toDir === 'top') || (fromDir === 'bottom' && toDir === 'bottom')) {
				const routeY = fromDir === 'top'
					? Math.min(fromRect.y, toRect.y) - GAP
					: Math.max(fromRect.y + fromRect.h, toRect.y + toRect.h) + GAP;
				p2 = { x: p1.x, y: routeY }; p3 = { x: p4.x, y: routeY };
			} else if ((fromDir === 'left' && toDir === 'left') || (fromDir === 'right' && toDir === 'right')) {
				const routeX = fromDir === 'left'
					? Math.min(fromRect.x, toRect.x) - GAP
					: Math.max(fromRect.x + fromRect.w, toRect.x + toRect.w) + GAP;
				p2 = { x: routeX, y: p1.y }; p3 = { x: routeX, y: p4.y };
			}
		}

		return [p1, p2, p3, p4];
	}

	function getDFDFromExitIsHorizontal(flow: DFDFlow, fromNode: DFDNode, toNode: DFDNode): boolean {
		const auto = diagram.dfdFlowPortOffsets.get(flow.id);
		const fromDir = flow.fromSide || auto?.fromSide || dfdNaturalDir(fromNode.position.x, fromNode.position.y, toNode.position.x, toNode.position.y, fromNode.type);
		return fromDir === 'left' || fromDir === 'right';
	}


	let isMobile = $state(false);
	let resizeObserver: ResizeObserver | undefined;

	onMount(() => {
		const check = () => {
			isMobile = window.innerWidth < 768;
			updateCanvasSize();
		};

		check();
		window.addEventListener('resize', check);


		if (svgEl) {
			resizeObserver = new ResizeObserver(() => updateCanvasSize());
			resizeObserver.observe(svgEl);
		}


		if (svgEl) {
			svgEl.addEventListener('wheel', handleWheel, { passive: false });
			svgEl.addEventListener('touchstart', handleTouchStart, { passive: false });
			svgEl.addEventListener('touchmove', handleTouchMove, { passive: false });
			svgEl.addEventListener('touchend', handleTouchEnd, { passive: false });
		}

		return () => {
			if (wheelZoomTimer) clearTimeout(wheelZoomTimer);
			if (rafId) cancelAnimationFrame(rafId);
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


	let lastTapTime = 0;


	let dragging = $state<{ offsets: Map<string, { dx: number; dy: number }>; startX: number; startY: number } | null>(null);



	let pendingMovePush = false;
	let draggingNote = $state<{ noteId: string; dx: number; dy: number } | null>(null);
	let panning = $state<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);





	let altHeld = $state(false);




	let draggingWord = $state<{
		nodeId: string;
		wordIndex: number;
		startOffsetX: number;
		startOffsetY: number;
		startSvgX: number;
		startSvgY: number;
		moved: boolean;
	} | null>(null);

	function handleWordMouseDown(nodeId: string, wordIndex: number, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly) return;


		if (!e.altKey || e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();

		const node = diagram.flowNodes.find((n) => n.id === nodeId);
		if (!node || node.type !== 'preparation') return;

		const svgPos = screenToSvg(e.clientX, e.clientY);





		const existing = node.wordOffsets?.[wordIndex] ?? { x: 0, y: 0 };


		node.manualSize = true;

		draggingWord = {
			nodeId,
			wordIndex,
			startOffsetX: existing.x,
			startOffsetY: existing.y,
			startSvgX: svgPos.x,
			startSvgY: svgPos.y,
			moved: false
		};
	}


	let draggingConnection = $state<{ fromNodeId: string; fromSide: 'top' | 'right' | 'bottom' | 'left'; startX: number; startY: number; currentX: number; currentY: number; screenStartX: number; screenStartY: number } | null>(null);
	let hoveredNodeId = $state<string | null>(null);

	let hoveredPortSide = $state<Side | null>(null);
	let hoveredFlowNodeId = $state<string | null>(null);
	let hoveredDFDNodeId = $state<string | null>(null);



	const isTouchDevice =
		typeof window !== 'undefined' &&
		(('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0);


	let selecting = $state<{ startX: number; startY: number; screenX: number; screenY: number } | null>(null);
	let selectCurrent = $state({ x: 0, y: 0 });


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


	let contextMenu = $state<{ x: number; y: number } | null>(null);



	let connectMenu = $state<{
		x: number;
		y: number;
		fromNodeId: string;
		side: 'top' | 'right' | 'bottom' | 'left';
		mode: 'nodes' | 'newType';
	} | null>(null);



	const NEW_NODE_TYPES: { type: FlowNodeType; label: string }[] = [
		{ type: 'process', label: '▭ Process' },
		{ type: 'decision', label: '◇ Decision' },
		{ type: 'start-end', label: '⬭ Start/End' },
		{ type: 'input-output', label: '▱ Input/Output' },
		{ type: 'document', label: ' Document' },
		{ type: 'database', label: ' Database' },
		{ type: 'connector', label: '◯ Connector' },
		{ type: 'predefined-process', label: '▥ Predef. Process' },
		{ type: 'delay', label: '◗ Delay' }
	];


	let editingLabel = $state<{
		nodeId?: string;
		edgeId?: string;
		dfdFlowId?: string;
		text: string;

		rect?: DOMRect;

		fontSize?: number;

		node?: {
			x: number;
			y: number;
			width: number;
			height: number;
			fontSize: number;
			fontWeight: number;
			fontStyle: string;
			color: string;
		};
	} | null>(null);


	let resizing = $state<{
		nodeId: string;
		handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
		startX: number;
		startY: number;
		startWidth: number;
		startHeight: number;
		startPosX: number;
		startPosY: number;
	} | null>(null);


	let draggingWaypoint = $state<{
		edgeId: string;
		waypointIndex: number;
		startX: number;
		startY: number;
	} | null>(null);


	let pendingFlowEdgeDrag = $state<{
		edgeId: string;
		screenX: number;
		screenY: number;
	} | null>(null);


	let draggingFlowSegment = $state<{
		edgeId: string;
		constraint: 'x' | 'y';
		offset: number;
		route: Position[];
		segment: number;
	} | null>(null);


	let draggingDFDSegment = $state<{
		flowId: string;
		constraint: 'x' | 'y';
		offset: number;
	} | null>(null);


	let pendingDFDLineDrag = $state<{
		flowId: string;
		screenX: number;
		screenY: number;
	} | null>(null);


	let draggingDFDLabel = $state<{
		flowId: string;
		offsetX: number;
		offsetY: number;
	} | null>(null);


	let alignmentGuides = $state<{
		vertical: number[];
		horizontal: number[];
	}>({ vertical: [], horizontal: [] });


	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressStartPos: { x: number; y: number } | null = null;
	const LONG_PRESS_MS = 500;
	const LONG_PRESS_MOVE_THRESHOLD = 10;

	const TAP_MOVE_THRESHOLD = 8;




	let touchStartNodeId: string | null = null;
	let touchMoved = false;


	const DOUBLE_TAP_MS = 300;
	let lastTapNodeId: string | null = null;
	let lastNodeTapTime = 0;

	function closeContextMenu() {
		contextMenu = null;
	}

	function handleEntityContextMenu(nodeId: string, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
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

		if (diagram.selectedEdgeId && diagram.selectedNodeIds.length === 0) {
			const edgeId = diagram.selectedEdgeId;
			return [{
				label: 'ลบ',
				danger: true,
				action: () => {
					if (diagram.diagramType === 'er') {
						diagram.removeRelationship(edgeId);
					} else if (diagram.diagramType === 'flowchart') {
						diagram.removeFlowEdge(edgeId);
					} else if (diagram.diagramType === 'context') {
						diagram.removeDFDFlow(edgeId);
					}
					closeContextMenu();
				}
			}];
		}

		const items: MenuItem[] = [
			{ label: 'คัดลอก', action: () => { diagram.copySelected(); closeContextMenu(); } },
			{ label: 'วาง', action: () => { diagram.paste(); closeContextMenu(); } },
		];



		if (diagram.diagramType === 'flowchart' && diagram.selectedNodeIds.length > 0) {
			const nodes = () => diagram.flowNodes.filter(n => diagram.selectedNodeIdSet.has(n.id));
			const first = () => nodes()[0];
			const SWATCHES = ['#ffffff', '#dbeafe', '#dcfce7', '#fef9c3', '#fee2e2', '#f3e8ff', '#1e293b'];

			items.push(
				{
					kind: 'toggles',
					label: 'ตัวอักษร',
					divider: true,
					toggles: [
						{
							label: 'B', bold: true, active: first()?.bold ?? true,
							onToggle: () => { const v = !(first()?.bold ?? true); for (const n of nodes()) diagram.updateFlowNode(n.id, { bold: v }); }
						},
						{
							label: 'I', italic: true, active: first()?.italic ?? false,
							onToggle: () => { const v = !(first()?.italic ?? false); for (const n of nodes()) diagram.updateFlowNode(n.id, { italic: v }); }
						}
					]
				},
				{
					kind: 'stepper',
					label: 'ขนาด',
					value: first()?.fontSize ?? diagram.diagramFontSize,
					onDec: () => { for (const n of nodes()) diagram.updateFlowNode(n.id, { fontSize: Math.max(8, (n.fontSize ?? diagram.diagramFontSize) - 1) }); },
					onInc: () => { for (const n of nodes()) diagram.updateFlowNode(n.id, { fontSize: Math.min(48, (n.fontSize ?? diagram.diagramFontSize) + 1) }); }
				},
				{
					kind: 'color',
					label: 'สี',
					colors: SWATCHES,
					current: first()?.color,
					onPick: (c: string) => { for (const n of nodes()) diagram.updateFlowNode(n.id, { color: c }); }
				}
			);


			if (first()?.type === 'start-end') {
				items.push({
					kind: 'stepper',
					label: 'ความโค้งมุม',
					value: first()?.borderRadius ?? 20,
					onDec: () => { for (const n of nodes()) diagram.updateFlowNode(n.id, { borderRadius: Math.max(0, (n.borderRadius ?? 20) - 4) }); },
					onInc: () => { for (const n of nodes()) diagram.updateFlowNode(n.id, { borderRadius: Math.min(50, (n.borderRadius ?? 20) + 4) }); }
				});
			}

		}


		if (
			diagram.diagramType === 'context' &&
			diagram.selectedNodeIds.length === 1
		) {
			const only = diagram.dfdNodes.find((n) => n.id === diagram.selectedNodeIds[0]);
			if (only?.type === 'process' && diagram.dfdDrillPath.length < 2) {
				const has = diagram.dfdNodesWithChildren.has(only.id);
				items.push({
					label: has ? 'เปิดระดับย่อย (drill-down)' : 'สร้าง/เปิดระดับย่อย (drill-down)',
					action: () => {
						diagram.drillIntoDFDNode(only.id);
						closeContextMenu();
						tick().then(() => fitToContent());
					},
					divider: true
				});
			}
		}


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




	const entityRects = $derived(
		new Map(diagram.entities.map((e) => {
			const base = renderer.getEntityRect(e);
			const scale = (e.fontSize ?? diagram.diagramFontSize) / 14;
			if (scale === 1) return [e.id, base] as const;
			return [e.id, {
				x: base.x,
				y: base.y,
				width: Math.round(base.width * scale),
				height: Math.round(base.height * scale)
			}] as const;
		}))
	);


	function distributeConnectionPoints(
		relationships: typeof diagram.relationships,
		rects: Map<string, Rect>
	) {

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


		const groups = new Map<string, SideInfo[]>();
		for (const info of sideAssignments) {
			const key = `${info.entityId}:${info.side}`;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(info);
		}
		for (const group of groups.values()) {
			const horizontal = group[0].side === 'top' || group[0].side === 'bottom';
			group.sort((a, b) => {
				const ar = rects.get(a.otherEntityId)!, br = rects.get(b.otherEntityId)!;
				return horizontal ? ar.x + ar.width / 2 - br.x - br.width / 2 : ar.y + ar.height / 2 - br.y - br.height / 2;
			});
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
		const spacing = 30;
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


	const relationshipData = $derived.by(() => {
		const distributed = distributeConnectionPoints(diagram.relationships, entityRects);
		return distributed.map((d) => {
			const rel = diagram.relationships.find((r) => r.id === d.relId)!;
			return { relationship: rel, fromRect: d.fromRect, toRect: d.toRect, fromPoint: rel.fromAnchor ? anchorPoint(d.fromRect, rel.fromAnchor) : d.from, toPoint: rel.toAnchor ? anchorPoint(d.toRect, rel.toAnchor) : d.to };
		});
	});

	const visibleEntities = $derived(diagram.entities);
	const visibleRelData = $derived(relationshipData);
	const erRoutingObstacles = $derived([...entityRects].map(([id, rect]) => ({ id, name: '', type: 'process' as const, position: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, width: rect.width, height: rect.height })));


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



	const erParticlePaths = $derived.by((): PathData[] => {
		if (diagram.diagramType !== 'er') return [];
		return visibleRelData.flatMap(data => {
			const direction = data.relationship.dataFlowDirection ?? 'none';
			if (direction === 'none') return [];
			return [{
				id: data.relationship.id,
				d: direction === 'reverse'
					? createOrthogonalPath(data.toPoint, data.fromPoint)
					: createOrthogonalPath(data.fromPoint, data.toPoint),
				particleCount: 1,
				bidirectional: direction === 'both'
			}];
		});
	});


	const getFlowEdgeFromSide = (edge: FlowEdge, fromNode: FlowNode, toNode: FlowNode) =>
		resolveFlowSides(edge, fromNode, toNode).fromSide;

	const flowParticlePaths = $derived.by((): PathData[] => {
		if (diagram.diagramType !== 'flowchart') return [];
		return diagram.flowEdges.map((edge): PathData | null => {
			const fromNode = diagram.flowNodes.find(n => n.id === edge.fromNodeId);
			const toNode = diagram.flowNodes.find(n => n.id === edge.toNodeId);
			if (!fromNode || !toNode) return null;

			const offset = flowEdgeOffsets.get(edge.id) ?? 0;
			const lineStyle = edge.lineStyle || 'orthogonal';



			const route = getFlowEdgeRoute(edge, fromNode, toNode, offset, diagram.smartRouting ? diagram.flowNodes : undefined, flowPorts.get(edge.id));


			let d: string;
			if (lineStyle === 'straight') {
				d = `M${route[0].x},${route[0].y} L${route[route.length - 1].x},${route[route.length - 1].y}`;
			} else if (lineStyle === 'curved') {
				if (route.length === 2) {
					d = `M${route[0].x},${route[0].y} L${route[1].x},${route[1].y}`;
				} else {
					d = `M${route[0].x},${route[0].y}`;
					for (let i = 0; i < route.length - 1; i++) {
						const p1 = route[i];
						const p2 = route[i + 1];
						if (i === 0) {
							const cp1x = p1.x + (p2.x - p1.x) * 0.5;
							const cp1y = p1.y;
							const cp2x = p2.x;
							const cp2y = p1.y + (p2.y - p1.y) * 0.5;
							d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
						} else {
							const cp1x = p1.x;
							const cp1y = p1.y + (p2.y - p1.y) * 0.5;
							const cp2x = p2.x;
							const cp2y = p1.y + (p2.y - p1.y) * 0.5;
							d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
						}
					}
				}
			} else {
				d = route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
			}

			const start = edge.startArrow ?? ((edge.arrowDirection === 'start' || edge.arrowDirection === 'both') ? edge.arrowHead || 'filled' : 'none');
			const end = edge.endArrow ?? (edge.arrowDirection !== 'start' ? edge.arrowHead || 'filled' : 'none');
			if (start === 'none' && end === 'none') return null;
			return { id: edge.id, d, particleCount: 1, bidirectional: start !== 'none' && end !== 'none', reverse: start !== 'none' && end === 'none' };
		}).filter((p): p is PathData => p !== null);
	});

	const dfdParticlePaths = $derived.by((): PathData[] => {
		if (diagram.diagramType !== 'context') return [];
		return diagram.dfdVisibleFlows.map(flow => {
			const fromNode = diagram.dfdNodes.find(n => n.id === flow.fromNodeId);
			const toNode = diagram.dfdNodes.find(n => n.id === flow.toNodeId);
			if (!fromNode || !toNode) return null;

			const pts = getDFDFlowRoute(flow, fromNode, toNode);
			if (pts.length < 2) return null;
			const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
			return { id: flow.id, d, particleCount: 1, bidirectional: false };
		}).filter((p): p is PathData => p !== null);
	});

	const allParticlePaths = $derived([...erParticlePaths, ...flowParticlePaths, ...dfdParticlePaths]);


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


	function handleCanvasDragOver(e: DragEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		const mime = diagram.diagramType === 'er' ? 'application/x-er-shape' : diagram.diagramType === 'flowchart' ? 'application/x-flow-shape' : diagram.diagramType === 'context' ? 'application/x-dfd-shape' : '';
		if (!mime || !e.dataTransfer?.types.includes(mime)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}

	function handleCanvasDrop(e: DragEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		if (diagram.diagramType === 'context') {
			const type = e.dataTransfer?.getData('application/x-dfd-shape');
			if (type === 'process' || type === 'external-entity' || type === 'data-store') {
				e.preventDefault(); diagram.addDFDNode('', type, screenToSvg(e.clientX, e.clientY));
			}
			return;
		}
		if (diagram.diagramType === 'er') {
			const type = e.dataTransfer?.getData('application/x-er-shape');
			if (type) { e.preventDefault(); placeERShape(type, screenToSvg(e.clientX, e.clientY)); }
			return;
		}
		if (diagram.diagramType !== 'flowchart') return;
		const type = e.dataTransfer?.getData('application/x-flow-shape');
		if (!type) return;
		e.preventDefault();
		const pos = screenToSvg(e.clientX, e.clientY);
		diagram.addFlowNode('', type as FlowNodeType, pos);
	}


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


	function moveNode(id: string, pos: { x: number; y: number }) {


		if (pendingMovePush) {
			pendingMovePush = false;
			diagram.pushHistory();
		}
		if (diagram.diagramType === 'flowchart') {
			diagram.moveFlowNode(id, pos);
		} else if (diagram.diagramType === 'context') {
			diagram.moveDFDNode(id, pos);
		} else {
			diagram.moveEntity(id, pos);
		}
	}



	function updateConnectionDrag(clientX: number, clientY: number) {
		if (!draggingConnection) return;
		const svgPos = screenToSvg(clientX, clientY);
		draggingConnection.currentX = svgPos.x;
		draggingConnection.currentY = svgPos.y;

		hoveredNodeId = null;
		hoveredPortSide = null;
		if (diagram.diagramType === 'er') {
			for (const [id, rect] of entityRects) {
				if (id === draggingConnection.fromNodeId) continue;
				const pad = 14 / diagram.zoom;
				if (svgPos.x >= rect.x - pad && svgPos.x <= rect.x + rect.width + pad && svgPos.y >= rect.y - pad && svgPos.y <= rect.y + rect.height + pad) {
					hoveredNodeId = id; hoveredPortSide = nearestERAnchor(rect, svgPos).side; break;
				}
			}
		}
		if (diagram.diagramType === 'flowchart') {
			for (const node of diagram.flowNodes) {
				if (node.id === draggingConnection.fromNodeId && Math.hypot(clientX - draggingConnection.screenStartX, clientY - draggingConnection.screenStartY) < 24) continue;
				const { position } = node;
				const W = node.width || (node.type === 'connector' ? 28 : 140);
				const H = node.height || (node.type === 'connector' ? 28 : 60);
				const PAD = 14 / diagram.zoom;
				if (
					svgPos.x >= position.x - W / 2 - PAD &&
					svgPos.x <= position.x + W / 2 + PAD &&
					svgPos.y >= position.y - H / 2 - PAD &&
					svgPos.y <= position.y + H / 2 + PAD
				) {
					hoveredNodeId = node.id;
					hoveredPortSide = nearestSide(node, svgPos);
					break;
				}
			}
		} else if (diagram.diagramType === 'context') {
			const PAD = 15;
			for (const node of diagram.dfdVisibleNodes) {
				if (node.id === draggingConnection.fromNodeId) continue;
				const rect = getDFDNodeRect(node);
				if (
					svgPos.x >= rect.x - PAD &&
					svgPos.x <= rect.x + rect.w + PAD &&
					svgPos.y >= rect.y - PAD &&
					svgPos.y <= rect.y + rect.h + PAD
				) {
					hoveredNodeId = node.id;
					const sides = [{ side: 'top' as const, distance: Math.abs(svgPos.y - rect.y) }, { side: 'bottom' as const, distance: Math.abs(svgPos.y - rect.y - rect.h) }, { side: 'left' as const, distance: Math.abs(svgPos.x - rect.x) }, { side: 'right' as const, distance: Math.abs(svgPos.x - rect.x - rect.w) }];
					hoveredPortSide = sides.sort((a, b) => a.distance - b.distance)[0].side;
					break;
				}
			}
		}
	}

	function handleStartConnection(nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', clientX: number, clientY: number) {
		if (collab.isViewer || diagram.viewOnly) return;
		const svgPos = screenToSvg(clientX, clientY);

		let startX = svgPos.x, startY = svgPos.y;
		if (diagram.diagramType === 'er') {
			const rect = entityRects.get(nodeId);
			if (!rect) return;
			startX = rect.x + (side === 'left' ? 0 : side === 'right' ? rect.width : rect.width / 2);
			startY = rect.y + (side === 'top' ? 0 : side === 'bottom' ? rect.height : rect.height / 2);
		}
		if (diagram.diagramType === 'context') {
			const node = diagram.dfdNodes.find(n => n.id === nodeId);
			if (node) {
				const rect = getDFDNodeRect(node);
				if (side === 'top') { startY = rect.y; startX = node.position.x; }
				else if (side === 'bottom') { startY = rect.y + rect.h; startX = node.position.x; }
				else if (side === 'left') { startX = rect.x; startY = node.position.y; }
				else { startX = rect.x + rect.w; startY = node.position.y; }
			}
		} else if (diagram.diagramType === 'flowchart') {
			const node = diagram.flowNodes.find(n => n.id === nodeId);
			if (node) {
				const port = getFlowPort(node, side);
				startX = port.x; startY = port.y;
			}
		}
		draggingConnection = {
			fromNodeId: nodeId,
			fromSide: side,
			startX,
			startY,
			currentX: svgPos.x,
			currentY: svgPos.y,
			screenStartX: clientX,
			screenStartY: clientY
		};
	}



	const toEntrySide = (side: 'top' | 'right' | 'bottom' | 'left') =>
		side === 'right' ? 'left' : side === 'left' ? 'right' : side === 'bottom' ? 'top' : 'bottom';


	function connectToNode(fromNodeId: string, side: 'top' | 'right' | 'bottom' | 'left', targetId: string) {
		if (collab.isViewer || diagram.viewOnly) return;
		const exists = diagram.flowEdges.some(e =>
			(e.fromNodeId === fromNodeId && e.toNodeId === targetId && e.fromSide === side)
		);
		if (!exists) {
			diagram.addFlowEdge('', fromNodeId, targetId, undefined, { fromSide: side, toSide: toEntrySide(side) });
		}
		diagram.selectEntity(targetId);
	}



	function spawnAndConnect(fromNodeId: string, side: 'top' | 'right' | 'bottom' | 'left', type?: FlowNodeType) {
		if (collab.isViewer || diagram.viewOnly) return;
		const from = diagram.flowNodes.find(n => n.id === fromNodeId);
		if (!from) return;
		const newType = type ?? from.type;
		const W = from.width || 140;
		const H = from.height || 60;
		const GAP = 60;
		const newW = W, newH = H;
		let nx = from.position.x, ny = from.position.y;
		if (side === 'right') nx = from.position.x + W / 2 + GAP + newW / 2;
		else if (side === 'left') nx = from.position.x - W / 2 - GAP - newW / 2;
		else if (side === 'bottom') ny = from.position.y + H / 2 + GAP + newH / 2;
		else ny = from.position.y - H / 2 - GAP - newH / 2;

		const newNode = diagram.addFlowNode('', newType, { x: nx, y: ny });


		diagram.addFlowEdge('', fromNodeId, newNode.id, undefined, { fromSide: side, toSide: toEntrySide(side) });
		diagram.selectEntity(newNode.id);
		startEditingFlowNode(newNode.id);
	}



	function findNodesInDirection(
		from: { id: string; position: { x: number; y: number } },
		side: 'top' | 'right' | 'bottom' | 'left'
	) {
		const fx = from.position.x, fy = from.position.y;
		const out: { node: (typeof diagram.flowNodes)[number]; dist: number }[] = [];
		for (const n of diagram.flowNodes) {
			if (n.id === from.id) continue;

			const linked = diagram.flowEdges.some(e =>
				(e.fromNodeId === from.id && e.toNodeId === n.id && e.fromSide === side)
			);
			if (linked) continue;
			const dx = n.position.x - fx;
			const dy = n.position.y - fy;

			let ok = false;
			if (side === 'right') ok = dx > 0 && Math.abs(dx) >= Math.abs(dy);
			else if (side === 'left') ok = dx < 0 && Math.abs(dx) >= Math.abs(dy);
			else if (side === 'bottom') ok = dy > 0 && Math.abs(dy) >= Math.abs(dx);
			else ok = dy < 0 && Math.abs(dy) >= Math.abs(dx);
			if (!ok) continue;
			out.push({ node: n, dist: Math.hypot(dx, dy) });
		}
		out.sort((a, b) => a.dist - b.dist);
		return out.map((o) => o.node);
	}


	function openConnectMenu(fromNodeId: string, side: 'top' | 'right' | 'bottom' | 'left', clientX: number, clientY: number) {
		if (collab.isViewer || diagram.viewOnly) return;
		if (diagram.diagramType !== 'flowchart') return;


		if (draggingConnection || dragging || panning || resizing) return;
		connectMenu = { x: clientX, y: clientY, fromNodeId, side, mode: 'nodes' };
	}

	function closeConnectMenu() {
		connectMenu = null;
	}




	function getConnectMenuItems(): MenuItem[] {
		if (!connectMenu) return [];
		const { fromNodeId, side, mode } = connectMenu;
		const from = diagram.flowNodes.find(n => n.id === fromNodeId);
		if (!from) return [];

		if (mode === 'newType') {
			const items: MenuItem[] = NEW_NODE_TYPES.map((t) => ({
				label: t.label,
				action: () => { spawnAndConnect(fromNodeId, side, t.type); closeConnectMenu(); }
			}));
			items.push({
				label: '← ย้อนกลับ',
				action: () => { if (connectMenu) connectMenu = { ...connectMenu, mode: 'nodes' }; },
				divider: true
			});
			return items;
		}

		const candidates = findNodesInDirection(from, side);
		const items: MenuItem[] = candidates.map((n, i) => ({
			label: n.name?.trim() || `Node ${i + 1}`,
			action: () => { connectToNode(fromNodeId, side, n.id); closeConnectMenu(); }
		}));
		items.push({
			label: ' สร้าง Node ใหม่…',
			action: () => { if (connectMenu) connectMenu = { ...connectMenu, mode: 'newType' }; },
			divider: items.length > 0
		});
		return items;
	}

	function handleEntityMouseDown(entityId: string, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		if (e.button === 0) {
			e.stopPropagation();


			if (e.shiftKey) {
				diagram.toggleEntitySelection(entityId);
				return;
			} else if (!diagram.selectedNodeIdSet.has(entityId)) {

				diagram.selectEntity(entityId);
			}




			const svgPos = screenToSvg(e.clientX, e.clientY);
			const ids = diagram.selectedNodeIds;
			const offsets = new Map<string, { dx: number; dy: number }>();
			for (const id of ids) {

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

				if (!diagram.physicsMode) pendingMovePush = true;
				dragging = { offsets, startX: svgPos.x, startY: svgPos.y };

				diagram.localDraggingIds = new Set(offsets.keys());

				if (diagram.physicsMode) {
					for (const id of offsets.keys()) {
						diagram.physicsPin(id);
					}
				}
			}
		}
	}

	function handleEntityTouchStart(entityId: string, e: TouchEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		if (e.touches.length !== 1) return;
		e.stopPropagation();


		if (collab.connected) {
			const t = e.touches[0];
			const pos = screenToSvg(t.clientX, t.clientY);
			collab.updateCursor(pos.x, pos.y);
		}


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

		touchStartNodeId = entityId;
		touchMoved = false;

		const touch = e.touches[0];
		const svgPos = screenToSvg(touch.clientX, touch.clientY);
		const ids = diagram.selectedNodeIds;
		const offsets = new Map<string, { dx: number; dy: number }>();
		for (const id of ids) {

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


			pendingMovePush = true;
			diagram.localDraggingIds = new Set(offsets.keys());
			touchState = { type: 'drag', entityId, offsets };
		}


		longPressStartPos = { x: touch.clientX, y: touch.clientY };
		clearLongPressTimer();
		longPressTimer = setTimeout(() => {

			if (typeof navigator !== 'undefined' && navigator.vibrate) {
				navigator.vibrate(50);
			}
			contextMenu = { x: touch.clientX, y: touch.clientY };

			diagram.localDraggingIds = new Set();
			touchState = null;
			longPressTimer = null;
			longPressStartPos = null;
		}, LONG_PRESS_MS);
	}

	function handleRelTouchStart(relId: string, e: TouchEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		if (e.touches.length !== 1) return;
		e.stopPropagation();

		diagram.selectRelationship(relId);

		const touch = e.touches[0];
		longPressStartPos = { x: touch.clientX, y: touch.clientY };
		clearLongPressTimer();
		longPressTimer = setTimeout(() => {
			if (typeof navigator !== 'undefined' && navigator.vibrate) {
				navigator.vibrate(50);
			}
			contextMenu = { x: touch.clientX, y: touch.clientY };
			longPressTimer = null;
			longPressStartPos = null;
		}, LONG_PRESS_MS);
	}




	function handleEdgeTouchStart(edgeId: string, e: TouchEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		if (e.touches.length !== 1) return;
		e.stopPropagation();

		diagram.selectRelationship(edgeId);

		const touch = e.touches[0];
		longPressStartPos = { x: touch.clientX, y: touch.clientY };
		clearLongPressTimer();
		longPressTimer = setTimeout(() => {
			if (typeof navigator !== 'undefined' && navigator.vibrate) {
				navigator.vibrate(50);
			}
			contextMenu = { x: touch.clientX, y: touch.clientY };
			longPressTimer = null;
			longPressStartPos = null;
		}, LONG_PRESS_MS);
	}

	function handleNoteMouseDown(noteId: string, e: MouseEvent) {
		diagram.selectEntity(noteId);
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


	let editingNoteId = $state<string | null>(null);
	let editingNoteText = $state('');


	let editingEntityId = $state<string | null>(null);
	let editingEntityName = $state('');

	async function handleNoteDblClick(noteId: string) {
		diagram.selectEntity(noteId);
		if (!await collab.acquireLocks([noteId])) return;
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

	async function handleEntityDblClick(entityId: string) {
		diagram.selectEntity(entityId);
		if (!await collab.acquireLocks([entityId])) return;
		if (collab.lockLabel(entityId)) return;
		if (collab.isViewer || diagram.viewOnly) return;
		const entity = diagram.entities.find((e) => e.id === entityId);
		if (!entity) return;
		editingEntityId = entityId;
		editingEntityName = entity.name;
	}



	function handleDFDNodeDblClick(nodeId: string) {
		if (collab.isViewer) return;
		const node = diagram.dfdNodes.find((n) => n.id === nodeId);
		if (!node || node.type !== 'process') return;
		diagram.drillIntoDFDNode(nodeId);


		tick().then(() => fitToContent());
	}

	function focusEntityEditor(node: HTMLInputElement) {
	 node.focus(); node.setSelectionRange(node.value.length, node.value.length);
	}

	function commitEntityEdit() {
		if (editingEntityId && editingEntityName.trim() !== '' && editingEntityName.trim() !== diagram.entities.find(e => e.id === editingEntityId)?.name) {
			diagram.updateEntity(editingEntityId, { name: editingEntityName.trim() });
		}
		editingEntityId = null;
		editingEntityName = '';
	}

	function cancelEntityEdit() {
		editingEntityId = null;
		editingEntityName = '';
	}




	async function startEditingFlowNode(nodeId: string) {
		diagram.selectEntity(nodeId);
		if (!await collab.acquireLocks([nodeId])) return;
		if (collab.lockLabel(nodeId)) return;
		if (collab.isViewer || diagram.viewOnly) return;
		const node = diagram.flowNodes.find(n => n.id === nodeId);
		if (!node) return;

		const W = node.width || (node.type === 'connector' ? 28 : 140);
		const H = node.height || (node.type === 'connector' ? 28 : 60);
		const bold = node.bold ?? true;

		editingLabel = {
			nodeId,
			text: node.name,
			node: {
				x: node.position.x - W / 2,
				y: node.position.y - H / 2,
				width: W,
				height: H,
				fontSize: flowNodeFontSize(node, diagram.diagramFontSize),
				fontWeight: flowNodeFontWeight(node),
				fontStyle: (node.italic ?? false) ? 'italic' : 'normal',
				color: theme.colors.entityHeaderText
			}
		};
	}

	function saveInlineEdit(newText: string) {
		if (!editingLabel) return;


		const text = newText.trim();

		if (editingLabel.dfdFlowId) {

			diagram.updateDFDFlow(editingLabel.dfdFlowId, { label: text });
			editingLabel = null;
			return;
		}

		if (editingLabel.nodeId) {



			const node = diagram.flowNodes.find(n => n.id === editingLabel!.nodeId);
			const updates: { name: string; width?: number; height?: number } = { name: text };
			if (text !== '') {
				const fs = node?.fontSize ?? diagram.diagramFontSize;
				const needed = nodeSizeForText(text, fs, diagram.diagramFont, node?.bold ?? true);
				if (node && (node.width ?? 140) < needed.width) updates.width = needed.width;
				if (node && (node.height ?? 60) < needed.height) updates.height = needed.height;
			}
			diagram.updateFlowNode(editingLabel.nodeId, updates);
		} else if (editingLabel.edgeId) {

			diagram.updateFlowEdge(editingLabel.edgeId, { label: text });
		}
		editingLabel = null;
	}

	async function startEditingDFDFlowLabel(flowId: string) {
		diagram.selectRelationship(flowId);
		if (!await collab.acquireLocks([flowId])) return;
		if (collab.isViewer || diagram.viewOnly) return;
		const flow = diagram.dfdFlows.find(f => f.id === flowId);
		if (!flow || !svgEl) return;
		const fromNode = diagram.dfdNodes.find(n => n.id === flow.fromNodeId);
		const toNode = diagram.dfdNodes.find(n => n.id === flow.toNodeId);
		if (!fromNode || !toNode) return;


		const route = getDFDFlowRoute(flow, fromNode, toNode);
		let midX = (route[0].x + route[route.length - 1].x) / 2;
		let midY = (route[0].y + route[route.length - 1].y) / 2;
		if (route.length >= 4) {
			midX = (route[1].x + route[2].x) / 2;
			midY = (route[1].y + route[2].y) / 2;
		}



		const editorW = 120;
		const left = midX * diagram.zoom + diagram.panX - editorW / 2;
		const top = midY * diagram.zoom + diagram.panY - 10;

		editingLabel = {
			dfdFlowId: flowId,
			text: flow.label || '',
			rect: new DOMRect(left, top, editorW, 20)
		};
	}

	function cancelInlineEdit() {
		editingLabel = null;
	}


	function getSVGPoint(e: MouseEvent | PointerEvent) {
		return screenToSvg(e.clientX, e.clientY);
	}

	function handleResizeStart(nodeId: string, handle: string, e: PointerEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		const node = diagram.diagramType === 'context' ? diagram.dfdNodes.find(n => n.id === nodeId) : diagram.flowNodes.find(n => n.id === nodeId);
		if (!node) return;
		const box = diagram.diagramType === 'context' ? getDFDNodeRect(node as DFDNode) : null;

		const svgPos = getSVGPoint(e);
		resizing = {
			nodeId,
			handle: handle as 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w',
			startX: svgPos.x,
			startY: svgPos.y,
			startWidth: box?.w ?? node.width ?? 140,
			startHeight: box?.h ?? node.height ?? 60,
			startPosX: node.position.x,
			startPosY: node.position.y
		};
	}

	function handleResizeMove(e: MouseEvent | PointerEvent) {
		const r = resizing;
		if (!r) return;

		const node = diagram.diagramType === 'context' ? diagram.dfdNodes.find(n => n.id === r.nodeId) : diagram.flowNodes.find(n => n.id === r.nodeId);
		if (!node) return;

		const svgPos = getSVGPoint(e);
		const dx = svgPos.x - r.startX;
		const dy = svgPos.y - r.startY;

		let newWidth = r.startWidth;
		let newHeight = r.startHeight;
		let newX = r.startPosX;
		let newY = r.startPosY;


		if (r.handle.includes('e')) {
			newWidth = r.startWidth + dx;
		}
		if (r.handle.includes('w')) {
			newWidth = r.startWidth - dx;
			newX = r.startPosX + dx / 2;
		}
		if (r.handle.includes('s')) {
			newHeight = r.startHeight + dy;
		}
		if (r.handle.includes('n')) {
			newHeight = r.startHeight - dy;
			newY = r.startPosY + dy / 2;
		}


		const isConnector = node.type === 'connector' || node.type === 'circle' || node.type === 'square';
		const minW = isConnector ? 8 : 60;
		const minH = isConnector ? 8 : 40;
		newWidth = Math.max(minW, newWidth);
		newHeight = Math.max(minH, newHeight);





		if (isConnector) {
			const changedW = r.handle.includes('e') || r.handle.includes('w');
			const changedH = r.handle.includes('n') || r.handle.includes('s');
			let size: number;
			if (changedW && changedH) size = Math.max(newWidth, newHeight);
			else if (changedW) size = newWidth;
			else size = newHeight;
			newWidth = size;
			newHeight = size;

			if (r.handle.includes('w')) newX = r.startPosX + r.startWidth / 2 - size / 2;
			else if (r.handle.includes('e')) newX = r.startPosX - r.startWidth / 2 + size / 2;
			else newX = r.startPosX;
			if (r.handle.includes('n')) newY = r.startPosY + r.startHeight / 2 - size / 2;
			else if (r.handle.includes('s')) newY = r.startPosY - r.startHeight / 2 + size / 2;
			else newY = r.startPosY;
		}


		if (diagram.showGrid && !isConnector) {
			newWidth = Math.round(newWidth / 20) * 20;
			newHeight = Math.round(newHeight / 20) * 20;
		}

		if (diagram.diagramType === 'context') {
			diagram.updateDFDNode(r.nodeId, { width: newWidth, height: newHeight });
			diagram.moveDFDNode(r.nodeId, { x: newX, y: newY });
			return;
		}
		diagram.updateFlowNode(r.nodeId, {
			width: newWidth,
			height: newHeight
		});
		diagram.moveFlowNode(r.nodeId, { x: newX, y: newY });
	}

	function handleResizeEnd() {
		if (resizing) {
			diagram.pushHistory('Resize node');
			resizing = null;
		}
	}


	function handleWaypointDragStart(edgeId: string, index: number, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		const svgPos = getSVGPoint(e);
		draggingWaypoint = {
			edgeId,
			waypointIndex: index,
			startX: svgPos.x,
			startY: svgPos.y
		};
	}

	function handleWaypointDrag(e: MouseEvent) {
		if (!draggingWaypoint) return;

		const edge = diagram.flowEdges.find(e => e.id === draggingWaypoint!.edgeId);
		if (!edge) return;

		const svgPos = getSVGPoint(e);
		const waypoints = [...(edge.waypoints || [])];



		const waypointArrayIndex = draggingWaypoint.waypointIndex - 1;

		if (waypointArrayIndex >= 0 && waypointArrayIndex < waypoints.length) {
			waypoints[waypointArrayIndex] = {
				x: diagram.showGrid ? Math.round(svgPos.x / 20) * 20 : svgPos.x,
				y: diagram.showGrid ? Math.round(svgPos.y / 20) * 20 : svgPos.y
			};

			diagram.updateFlowEdge(edge.id, { waypoints });
		}
	}

	function addWaypoint(edgeId: string, insertIndex: number) {
		const edge = diagram.flowEdges.find(e => e.id === edgeId);
		if (!edge) return;


		const fromNode = diagram.flowNodes.find(n => n.id === edge.fromNodeId);
		const toNode = diagram.flowNodes.find(n => n.id === edge.toNodeId);
		if (!fromNode || !toNode) return;


		const waypoints = [...(edge.waypoints || [])];



		const newPoint = { x: (fromNode.position.x + toNode.position.x) / 2, y: (fromNode.position.y + toNode.position.y) / 2 };

		waypoints.splice(Math.max(0, insertIndex - 1), 0, newPoint);

		diagram.updateFlowEdge(edge.id, { waypoints });
		diagram.pushHistory('Add waypoint');
	}

	function removeWaypoint(edgeId: string, index: number) {
		const edge = diagram.flowEdges.find(e => e.id === edgeId);
		if (!edge || !edge.waypoints) return;

		const waypointArrayIndex = index - 1;
		const waypoints = edge.waypoints.filter((_, i) => i !== waypointArrayIndex);

		diagram.updateFlowEdge(edge.id, { waypoints: waypoints.length > 0 ? waypoints : undefined });
		diagram.pushHistory('Remove waypoint');
	}


	function handleFlowEdgeMouseDown(edgeId: string, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		diagram.selectRelationship(edgeId);
		pendingFlowEdgeDrag = { edgeId, screenX: e.clientX, screenY: e.clientY };
	}

	const FLOW_EDGE_DRAG_THRESHOLD = 3;

	function promoteFlowEdgeDrag(e: MouseEvent) {
		if (!pendingFlowEdgeDrag) return;
		const dx = e.clientX - pendingFlowEdgeDrag.screenX;
		const dy = e.clientY - pendingFlowEdgeDrag.screenY;
		if (dx * dx + dy * dy < FLOW_EDGE_DRAG_THRESHOLD * FLOW_EDGE_DRAG_THRESHOLD) return;

		const { edgeId, screenX, screenY } = pendingFlowEdgeDrag;
		pendingFlowEdgeDrag = null;

		const edge = diagram.flowEdges.find(ed => ed.id === edgeId);
		if (!edge) return;
		const fromNode = diagram.flowNodes.find(n => n.id === edge.fromNodeId);
		const toNode = diagram.flowNodes.find(n => n.id === edge.toNodeId);
		if (!fromNode || !toNode) return;


  const route = getFlowEdgeRoute(edge, fromNode, toNode, flowEdgeOffsets.get(edge.id) ?? 0, diagram.smartRouting ? diagram.flowNodes : undefined, flowPorts.get(edge.id));
  const point = screenToSvg(screenX, screenY);
  let segment = -1, closest = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
   const a = route[i], b = route[i + 1];
   const dx = b.x - a.x, dy = b.y - a.y;
   const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
   const distance = Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
   if (distance < closest) { closest = distance; segment = i; }
  }
  if (segment < 0 || closest > 12 / diagram.zoom) return;
  const constraint = Math.abs(route[segment].x - route[segment + 1].x) < 0.01 ? 'x' : 'y';
  draggingFlowSegment = { edgeId, constraint, offset: route[segment][constraint] - point[constraint], route: route.map(p => ({ ...p })), segment };

	}

	function handleFlowSegmentDrag(e: MouseEvent) {
		if (!draggingFlowSegment) return;
		const edge = diagram.flowEdges.find(ed => ed.id === draggingFlowSegment!.edgeId);
		if (!edge) return;

		const svgPos = getSVGPoint(e);
		const wp = { ...draggingFlowSegment.route[draggingFlowSegment.segment] };

		const axis = draggingFlowSegment.constraint;
		const raw = svgPos[axis] + draggingFlowSegment.offset;
		const from = diagram.flowNodes.find(n => n.id === edge.fromNodeId);
		const to = diagram.flowNodes.find(n => n.id === edge.toNodeId);
		const otherAxis = axis === 'x' ? 'y' : 'x';
		const routes = diagram.flowEdges.filter(other => other.id !== edge.id && (!other.lineStyle || other.lineStyle === 'orthogonal')).flatMap(other => {
			const a = diagram.flowNodes.find(n => n.id === other.fromNodeId), b = diagram.flowNodes.find(n => n.id === other.toNodeId);
			return a && b ? [getFlowEdgeRoute(other, a, b, flowEdgeOffsets.get(other.id) ?? 0, diagram.smartRouting ? diagram.flowNodes : undefined, flowPorts.get(other.id))] : [];
		});
		const snap = !e.altKey && from && to ? snapFlowSegment(raw, axis, [draggingFlowSegment.route[draggingFlowSegment.segment][otherAxis], draggingFlowSegment.route[draggingFlowSegment.segment + 1][otherAxis]], routes, (e.shiftKey ? 28 : 10) / diagram.zoom) : null;
		let aligned = raw;
		if (!e.altKey && snap === null) {
			const candidates = draggingFlowSegment.route.map(p => p[axis]);
			if (e.shiftKey) {
				for (const points of routes) {
					for (let i = 1; i < points.length; i++) {
						if (Math.abs(points[i][axis] - points[i - 1][axis]) < 0.5) candidates.push(points[i][axis]);
					}
				}
				candidates.push(...diagram.flowNodes.map(node => node.position[axis]));
			}
			let distance = (e.shiftKey ? 28 : 6) / diagram.zoom;
			for (const value of candidates) { const delta = Math.abs(raw - value); if (delta < distance) { aligned = value; distance = delta; } }
		}
		wp[axis] = snap ?? aligned;

		const base = draggingFlowSegment.route;
  const index = draggingFlowSegment.segment;
  const moved = base.map(p => ({ ...p }));
  moved[index][axis] = wp[axis]; moved[index + 1][axis] = wp[axis];
  if (index === 0) {
   const a = base[0], b = base[1];
   const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
   const stubLength = Math.min(20, Math.hypot(b.x - a.x, b.y - a.y) / 2);
   const stub = { x: a.x + dx * stubLength, y: a.y + dy * stubLength };
   moved.splice(0, 1, { ...a }, stub, { ...stub, [axis]: wp[axis] });
  }
  if (index === base.length - 2) {
   const a = base[base.length - 1], b = base[base.length - 2];
   const stubLength = Math.min(20, Math.hypot(b.x - a.x, b.y - a.y) / 2);
   const stub = { x: a.x + Math.sign(b.x - a.x) * stubLength, y: a.y + Math.sign(b.y - a.y) * stubLength };
   moved.splice(moved.length - 1, 1, { ...stub, [axis]: wp[axis] }, stub, { ...a });
  }
  const crossesNode = diagram.flowNodes.some(node => {
   const hw = (node.width || (node.type === 'connector' ? 28 : 140)) / 2, hh = (node.height || (node.type === 'connector' ? 28 : 60)) / 2;
   const left = node.position.x - hw + 0.5, right = node.position.x + hw - 0.5;
   const top = node.position.y - hh + 0.5, bottom = node.position.y + hh - 0.5;
   return moved.slice(1).some((b, i) => {
    const a = moved[i];
    if (Math.abs(a.x - b.x) < 0.01) return a.x > left && a.x < right && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom;
    if (Math.abs(a.y - b.y) < 0.01) return a.y > top && a.y < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
    return true;
   });
  });
  if (!crossesNode) diagram.updateFlowEdge(edge.id, { waypoints: moved.slice(1, -1) });
	}


	function handleDFDLineMouseDown(flowId: string, e: MouseEvent) {
		if (collab.isViewer || diagram.viewOnly) return;
		diagram.selectRelationship(flowId);
		pendingDFDLineDrag = { flowId, screenX: e.clientX, screenY: e.clientY };
	}

	const DFD_DRAG_THRESHOLD = 10;

	function promotePendingDFDLineDrag(e: MouseEvent) {
		if (!pendingDFDLineDrag) return;
		const dx = e.clientX - pendingDFDLineDrag.screenX;
		const dy = e.clientY - pendingDFDLineDrag.screenY;
		if (dx * dx + dy * dy < DFD_DRAG_THRESHOLD * DFD_DRAG_THRESHOLD) return;

		const { flowId } = pendingDFDLineDrag;
		pendingDFDLineDrag = null;

		const flow = diagram.dfdFlows.find(f => f.id === flowId);
		if (!flow) return;
		const fromNode = diagram.dfdNodes.find(n => n.id === flow.fromNodeId);
		const toNode = diagram.dfdNodes.find(n => n.id === flow.toNodeId);
		if (!fromNode || !toNode) return;


		const isFromH = getDFDFromExitIsHorizontal(flow, fromNode, toNode);


		const constraint = isFromH ? 'x' : 'y';


		const route = getDFDFlowRoute(flow, fromNode, toNode);
		const midSegVal = constraint === 'x' ? route[1].x : route[1].y;


		if (!flow.waypoints || flow.waypoints.length === 0) {
			diagram.updateDFDFlow(flow.id, { waypoints: [{ x: route[1].x, y: route[1].y }] });
		}


		const svgPos = getSVGPoint(e);
		const mouseVal = constraint === 'x' ? svgPos.x : svgPos.y;
		const offset = midSegVal - mouseVal;

		draggingDFDSegment = { flowId, constraint, offset };
	}

	function handleDFDSegmentDrag(e: MouseEvent) {
		if (!draggingDFDSegment) return;
		const flow = diagram.dfdFlows.find(f => f.id === draggingDFDSegment!.flowId);
		if (!flow || !flow.waypoints || flow.waypoints.length === 0) return;

		const svgPos = getSVGPoint(e);
		const wp = { ...flow.waypoints[0] };

		if (draggingDFDSegment.constraint === 'x') {
			const raw = svgPos.x + draggingDFDSegment.offset;
			wp.x = diagram.showGrid ? Math.round(raw / 20) * 20 : raw;
		} else {
			const raw = svgPos.y + draggingDFDSegment.offset;
			wp.y = diagram.showGrid ? Math.round(raw / 20) * 20 : raw;
		}

		diagram.updateDFDFlow(flow.id, { waypoints: [wp] });
	}

	function handleMiddleMouseDown(e: MouseEvent) {
		if (e.button !== 1) return;
		e.preventDefault();
		e.stopPropagation();
		closeContextMenu();
		diagram.smoothTransition = false;
		panning = { startX: e.clientX, startY: e.clientY, panStartX: diagram.panX, panStartY: diagram.panY };
	}

	function handleCanvasMouseDown(e: MouseEvent) {
		diagram.smoothTransition = false;
		closeContextMenu();
		if (diagram.viewOnly) {

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



		if (e.button === 0 && diagram.stampShape && diagram.diagramType === 'flowchart') {
			const target = e.target as Element;
			if (!target.closest('.flow-node') && !target.closest('.flow-edge')) {
				const pos = screenToSvg(e.clientX, e.clientY);
				const node = diagram.addFlowNode('', diagram.stampShape, pos);
				addRipple(pos.x, pos.y);
				diagram.selectEntity(node.id);
				if (!e.shiftKey) diagram.stampShape = null;
				return;
			}
		}

		if (e.button === 0) {

			const target = e.target as Element;
			if (target.closest('.relationship-edge') || target.closest('.chen-diamond') || target.closest('.flow-edge') || target.closest('.dfd-flow')) return;

			diagram.clearSelection();

			const ripplePos = screenToSvg(e.clientX, e.clientY);
			addRipple(ripplePos.x, ripplePos.y);

			panning = {
				startX: e.clientX,
				startY: e.clientY,
				panStartX: diagram.panX,
				panStartY: diagram.panY
			};
		} else if (e.button === 2) {

			const target = e.target as Element;
			if (target.closest('.edge-tools') || target.closest('.connection-menu')) return;

			const svgPos = screenToSvg(e.clientX, e.clientY);
			selecting = { startX: svgPos.x, startY: svgPos.y, screenX: e.clientX, screenY: e.clientY };
			selectCurrent = { x: svgPos.x, y: svgPos.y };
		}
	}






	function computeFlowSnap(dragId: string, newX: number, newY: number): { dx: number; dy: number } {
		const SNAP_THRESHOLD = 3;
		const CONNECTED_SNAP = 6;

		const connectedIds = new Set<string>();
		for (const e of diagram.flowEdges) {
			if (e.fromNodeId === dragId) connectedIds.add(e.toNodeId);
			else if (e.toNodeId === dragId) connectedIds.add(e.fromNodeId);
		}

		let snapDx = 0, snapDy = 0;
		let bestX = Infinity, bestY = Infinity;
		for (const node of diagram.flowNodes) {
			if (node.id === dragId) continue;
			const thr = connectedIds.has(node.id) ? CONNECTED_SNAP : SNAP_THRESHOLD;

			const dX = Math.abs(newX - node.position.x);
			if (dX <= thr && dX < bestX) { bestX = dX; snapDx = node.position.x - newX; }

			const dY = Math.abs(newY - node.position.y);
			if (dY <= thr && dY < bestY) { bestY = dY; snapDy = node.position.y - newY; }
		}
		alignmentGuides = { vertical: [], horizontal: [] };
		if (bestX !== Infinity) alignmentGuides.vertical.push(newX + snapDx);
		if (bestY !== Infinity) alignmentGuides.horizontal.push(newY + snapDy);
		return { dx: snapDx, dy: snapDy };
	}

	let rafId = 0;
	let latestMouseMove: MouseEvent;
	function handleMouseMove(event: MouseEvent) {
		latestMouseMove = event;
		if (rafId) return;
		rafId = requestAnimationFrame(() => {
			rafId = 0;
			const e = latestMouseMove;
			if (draggingWord) {
				const dw = draggingWord;
				const svgPos = screenToSvg(e.clientX, e.clientY);
				const dx = svgPos.x - dw.startSvgX;
				const dy = svgPos.y - dw.startSvgY;
				if (!dw.moved && Math.hypot(dx, dy) > 1) {
					diagram.pushHistory('Move word');
					dw.moved = true;
				}
				const node = diagram.flowNodes.find((n) => n.id === dw.nodeId);
				if (node) {
					const off = {
						x: dw.startOffsetX + dx,
						y: dw.startOffsetY + dy
					};
					if (!node.wordOffsets) node.wordOffsets = {};
					node.wordOffsets[dw.wordIndex] = off;
					collab.pushFlowNodeChange(node);
				}
			} else if (draggingNote) {
				const svgPos = screenToSvg(e.clientX, e.clientY);
				diagram.moveNote(draggingNote.noteId, {
					x: svgPos.x - draggingNote.dx,
					y: svgPos.y - draggingNote.dy
				});
			} else if (dragging) {
				let svgPos = screenToSvg(e.clientX, e.clientY);

				if (e.shiftKey) {
					const adx = Math.abs(svgPos.x - dragging.startX);
					const ady = Math.abs(svgPos.y - dragging.startY);
					if (adx >= ady) {
						svgPos = { x: svgPos.x, y: dragging.startY };
					} else {
						svgPos = { x: dragging.startX, y: svgPos.y };
					}
				}




				const SNAP_THRESHOLD = 14;
				const CONNECTED_SNAP = 30;
				let snapDx = 0;
				let snapDy = 0;
				alignmentGuides = { vertical: [], horizontal: [] };

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


							for (const [dv, ov] of [[dEdges.l, oEdges.l], [dEdges.r, oEdges.r], [dEdges.cx, oEdges.cx], [dEdges.l, oEdges.r], [dEdges.r, oEdges.l]]) {
								if (Math.abs(dv - ov) <= SNAP_THRESHOLD) {
									snapDx = ov - dv;
									alignmentGuides.vertical.push(ov);
								}
							}


							for (const [dv, ov] of [[dEdges.t, oEdges.t], [dEdges.b, oEdges.b], [dEdges.cy, oEdges.cy], [dEdges.t, oEdges.b], [dEdges.b, oEdges.t]]) {
								if (Math.abs(dv - ov) <= SNAP_THRESHOLD) {
									snapDy = ov - dv;
									alignmentGuides.horizontal.push(ov);
								}
							}
						}
					}
				} else if (dragging.offsets.size === 1 && diagram.diagramType === 'flowchart') {
					const [dragId] = dragging.offsets.keys();
					const off = dragging.offsets.get(dragId)!;
					const draggedNode = diagram.flowNodes.find(n => n.id === dragId);
					if (draggedNode) {
						const snap = computeFlowSnap(dragId, svgPos.x - off.dx, svgPos.y - off.dy);
						snapDx = snap.dx;
						snapDy = snap.dy;
					}
				} else if (dragging.offsets.size === 1 && diagram.diagramType === 'context') {
					const [dragId] = dragging.offsets.keys();
					const off = dragging.offsets.get(dragId)!;
					const draggedNode = diagram.dfdNodes.find(n => n.id === dragId);
					if (draggedNode) {
						const newX = svgPos.x - off.dx;
						const newY = svgPos.y - off.dy;

						for (const node of diagram.dfdNodes) {
							if (node.id === dragId) continue;


							if (Math.abs(newX - node.position.x) <= SNAP_THRESHOLD) {
								snapDx = node.position.x - newX;
								alignmentGuides.vertical.push(node.position.x);
							}


							if (Math.abs(newY - node.position.y) <= SNAP_THRESHOLD) {
								snapDy = node.position.y - newY;
								alignmentGuides.horizontal.push(node.position.y);
							}
						}
					}
				}

				for (const [id, off] of dragging.offsets) {
					const newX = svgPos.x - off.dx + snapDx;
					const newY = svgPos.y - off.dy + snapDy;
					if (diagram.physicsMode) {
						diagram.physicsMoveBody(id, newX, newY);
					} else {
						moveNode(id, { x: newX, y: newY });
					}
				}
			} else if (draggingConnection) {
				updateConnectionDrag(e.clientX, e.clientY);
			} else if (panning) {
				diagram.setPan(
					panning.panStartX + (e.clientX - panning.startX),
					panning.panStartY + (e.clientY - panning.startY)
				);
			} else if (selecting) {
				const svgPos = screenToSvg(e.clientX, e.clientY);
				selectCurrent = { x: svgPos.x, y: svgPos.y };
			} else if (resizing) {
				handleResizeMove(e);
			} else if (draggingWaypoint) {
				handleWaypointDrag(e);
			} else if (draggingDFDLabel) {
				const svgPos = screenToSvg(e.clientX, e.clientY);
				const flow = diagram.dfdFlows.find(f => f.id === draggingDFDLabel!.flowId);
				if (flow) {
					flow.labelPosition = {
						x: svgPos.x + draggingDFDLabel!.offsetX,
						y: svgPos.y + draggingDFDLabel!.offsetY
					};
				}
			} else if (draggingFlowSegment) {
				handleFlowSegmentDrag(e);
			} else if (draggingDFDSegment) {
				handleDFDSegmentDrag(e);
			} else if (pendingDFDLineDrag) {
				promotePendingDFDLineDrag(e);
			} else if (pendingFlowEdgeDrag) {
				promoteFlowEdgeDrag(e);
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

		if (type === 'external-entity') return { x: cx - 60, y: cy - 25, width: 120, height: 50 };

		if (type === 'data-store') return { x: cx - 70, y: cy - 20, width: 140, height: 40 };

		if (type === 'process' && diagram.diagramType === 'context') {
			const n = diagram.dfdNodes.find(n => n.id === (node as any).id);
			const h = (n?.processNumber ? 28 : 0) + 50;
			return { x: cx - 70, y: cy - h / 2, width: 140, height: h };
		}

		if (type === 'connector') {
			const n = diagram.flowNodes.find(fn => fn.id === (node as any).id);
			const w = n?.width || 50, h = n?.height || 50;
			return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
		}

		return { x: cx - 70, y: cy - 30, width: 140, height: 60 };
	}



	function dropConnection(clientX: number, clientY: number) {
		if (draggingConnection && diagram.diagramType === 'er') updateConnectionDrag(clientX, clientY);
		const dc = draggingConnection;
		if (!dc) return;
		if (!hoveredNodeId && diagram.diagramType === 'flowchart') {


			const moved = Math.hypot(clientX - dc.screenStartX, clientY - dc.screenStartY);
			if (moved < 6) {

				draggingConnection = null;
				openConnectMenu(dc.fromNodeId, dc.fromSide, clientX, clientY);
			}
		} else if (hoveredNodeId) {
			if (diagram.diagramType === 'er' && !diagram.viewOnly && !collab.isViewer) {
				const targetRect = entityRects.get(hoveredNodeId);
				const rel = diagram.addRelationship('', [dc.fromNodeId, hoveredNodeId], ['1', 'N']);
				if (rel && targetRect) diagram.updateRelationship(rel.id, { fromAnchor: { side: dc.fromSide, ratio: 0.5 }, toAnchor: nearestERAnchor(targetRect, screenToSvg(clientX, clientY)) });
			}
			if (diagram.diagramType === 'flowchart') {


				const toSide = hoveredPortSide ?? undefined;
				diagram.addFlowEdge('', dc.fromNodeId, hoveredNodeId, undefined, { fromSide: dc.fromSide, toSide });
			} else if (diagram.diagramType === 'context') {
				const targetNode = diagram.dfdNodes.find(n => n.id === hoveredNodeId);
				const fromNode = diagram.dfdNodes.find(n => n.id === dc.fromNodeId);
				const mousePos = screenToSvg(clientX, clientY);
				const fSide = dc.fromSide;
				const isH = fSide === 'left' || fSide === 'right';


				const GAP = 20;
				const sx = dc.startX, sy = dc.startY;
				const exitX = fSide === 'right' ? sx + GAP : fSide === 'left' ? sx - GAP : sx;
				const exitY = fSide === 'bottom' ? sy + GAP : fSide === 'top' ? sy - GAP : sy;


				let toSide: 'top' | 'right' | 'bottom' | 'left' = 'left';
				let toPortOffset: number | undefined;
				if (targetNode) {
					const tRect = getDFDNodeRect(targetNode);
					const dTop = Math.abs(mousePos.y - tRect.y);
					const dBottom = Math.abs(mousePos.y - (tRect.y + tRect.h));
					const dLeft = Math.abs(mousePos.x - tRect.x);
					const dRight = Math.abs(mousePos.x - (tRect.x + tRect.w));
					const minD = Math.min(dTop, dBottom, dLeft, dRight);
					if (minD === dTop) toSide = 'top';
					else if (minD === dBottom) toSide = 'bottom';
					else if (minD === dLeft) toSide = 'left';
					else toSide = 'right';

					if (toSide === 'top' || toSide === 'bottom') {
						toPortOffset = mousePos.x - targetNode.position.x;
					} else {
						toPortOffset = mousePos.y - targetNode.position.y;
					}
				}


				let fromPortOffset: number | undefined;
				if (fromNode) {
					if (fSide === 'top' || fSide === 'bottom') {
						fromPortOffset = sx - fromNode.position.x;
					} else {
						fromPortOffset = sy - fromNode.position.y;
					}
				}


				const SPACING = 20;
				const pairFlows = diagram.dfdFlows.filter(f =>
					(f.fromNodeId === dc.fromNodeId && f.toNodeId === hoveredNodeId) ||
					(f.fromNodeId === hoveredNodeId && f.toNodeId === dc.fromNodeId)
				);
				const offset = pairFlows.length > 0
					? (isH ? (fSide === 'right' ? 1 : -1) : (fSide === 'bottom' ? 1 : -1)) * SPACING * pairFlows.length
					: 0;



				const midX = (exitX + mousePos.x) / 2;
				const midY = (exitY + mousePos.y) / 2;
				const wp = isH
					? { x: midX + offset, y: 0 }
					: { x: 0, y: midY + offset };

				diagram.addDFDFlow('', dc.fromNodeId, hoveredNodeId, fSide, hoveredPortSide ?? toSide, 0, 0);
			}
		}
	}

	function handleMouseUp(e: MouseEvent) {
		if (e.button === 1) { panning = null; return; }
		if (e.button === 0) {

			dropConnection(e.clientX, e.clientY);

			handleResizeEnd();

			if (draggingWaypoint) {
				diagram.pushHistory('Move waypoint');
				draggingWaypoint = null;
			}

			if (draggingFlowSegment) {
				diagram.pushHistory('Move flow segment');
				draggingFlowSegment = null;
			}

			if (draggingDFDSegment) {
				diagram.pushHistory('Move DFD segment');
				draggingDFDSegment = null;
			}

			if (draggingDFDLabel) {
				diagram.pushHistory('Move DFD label');
				draggingDFDLabel = null;
			}

			pendingDFDLineDrag = null;

			pendingFlowEdgeDrag = null;

			if (diagram.physicsMode && dragging) {
				for (const id of dragging.offsets.keys()) {
					diagram.physicsUnpin(id);
				}
			}

			if (dragging) {
				diagram.localDraggingIds = new Set();
			}
			dragging = null;
			pendingMovePush = false;
			diagram.flushMovePush();
			draggingNote = null;


			draggingWord = null;
			panning = null;
			draggingConnection = null;
			hoveredNodeId = null;
			hoveredPortSide = null;
			alignmentGuides = { vertical: [], horizontal: [] };
		} else if (e.button === 2 && selecting) {

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
				if (diagram.diagramType === 'flowchart') {
					const box = marqueeRect;
					const edgeIds = diagram.flowEdges.filter(edge => {
						const from = diagram.flowNodes.find(n => n.id === edge.fromNodeId), to = diagram.flowNodes.find(n => n.id === edge.toNodeId);
						if (!from || !to) return false;
						let route = getFlowEdgeRoute(edge, from, to, flowEdgeOffsets.get(edge.id) ?? 0, diagram.smartRouting ? diagram.flowNodes : undefined, flowPorts.get(edge.id));
						if (edge.lineStyle === 'straight') route = [route[0], route[route.length - 1]];
						return route.slice(1).some((p, i) => {
							const a = route[i];
							let lo = 0, hi = 1;
							for (const [start, delta, min, max] of [[a.x, p.x - a.x, box.x, box.x + box.width], [a.y, p.y - a.y, box.y, box.y + box.height]]) {
								if (delta === 0) { if (start < min || start > max) return false; }
								else { const t1 = (min - start) / delta, t2 = (max - start) / delta; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2)); }
							}
							return lo <= hi;
						});
					}).map(edge => edge.id);
					diagram.selectedFlowEdgeIds = edgeIds;
					diagram.selectedEdgeId = edgeIds.length === 1 ? edgeIds[0] : null;
				}
			}
			selecting = null;
		}
	}

	let wheelZoomTimer: ReturnType<typeof setTimeout> | undefined;
	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		if (collab.isViewer && !diagram.viewOnly) return;
		if (wheelZoomTimer) clearTimeout(wheelZoomTimer);
		if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
			diagram.smoothTransition = false;
			diagram.setPan(diagram.panX - (e.deltaX || e.deltaY), diagram.panY);
			return;
		}
		diagram.smoothTransition = !e.ctrlKey;
		wheelZoomTimer = setTimeout(() => { diagram.smoothTransition = false; }, 300);




		{


			if (!svgEl) return;
			const rect = svgEl.getBoundingClientRect();
			const cx = e.clientX - rect.left;
			const cy = e.clientY - rect.top;
			const oldZoom = diagram.zoom;
			const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1);
			const newZoom = Math.max(0.25, Math.min(3, oldZoom * Math.exp(-Math.max(-150, Math.min(150, delta)) * (e.ctrlKey ? 0.01 : 0.002))));
			if (newZoom === oldZoom) return;


			const sx = (cx - diagram.panX) / oldZoom;
			const sy = (cy - diagram.panY) / oldZoom;
			diagram.zoom = newZoom;
			diagram.setPan(cx - sx * newZoom, cy - sy * newZoom);
			return;
		}




	}


	function handleTouchStart(e: TouchEvent) {

		if (collab.connected && e.touches.length >= 1) {
			const t = e.touches[0];
			const pos = screenToSvg(t.clientX, t.clientY);
			collab.updateCursor(pos.x, pos.y);
		}
		if (collab.isViewer) return;


		if (draggingConnection) return;

		const target = e.target as Element;
		if (target.closest('.entity-node') || target.closest('.flow-node') || target.closest('.dfd-node') || target.closest('.relationship-edge') || target.closest('.chen-attribute')) return;



		if (target.closest('.resize-handle') || resizing) return;

		if (e.touches.length === 1) {

			const touch = e.touches[0];
			diagram.clearSelection();
			touchState = {
				type: 'pan',
				startTouches: [{ x: touch.clientX, y: touch.clientY }],
				panStartX: diagram.panX,
				panStartY: diagram.panY
			};
		} else if (e.touches.length === 2) {

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

		if (longPressTimer && touchState?.type === 'drag') {
			clearLongPressTimer();
		} else if (longPressStartPos && e.touches.length >= 1) {

			const t = e.touches[0];
			const dist = Math.hypot(t.clientX - longPressStartPos.x, t.clientY - longPressStartPos.y);
			if (dist > LONG_PRESS_MOVE_THRESHOLD) {
				clearLongPressTimer();
			}
		}



		if (!touchMoved && touchStartNodeId && longPressStartPos && e.touches.length >= 1) {
			const t = e.touches[0];
			const d = Math.hypot(t.clientX - longPressStartPos.x, t.clientY - longPressStartPos.y);
			if (d > TAP_MOVE_THRESHOLD) touchMoved = true;
		}


		if (draggingConnection && e.touches.length === 1) {
			e.preventDefault();
			const t = e.touches[0];
			updateConnectionDrag(t.clientX, t.clientY);
			return;
		}

		if (!touchState) return;
		e.preventDefault();


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


			let snapDx = 0, snapDy = 0;
			if (touchState.offsets.size === 1 && diagram.diagramType === 'flowchart') {
				const [dragId] = touchState.offsets.keys();
				const off = touchState.offsets.get(dragId)!;
				const snap = computeFlowSnap(dragId, svgPos.x - off.dx, svgPos.y - off.dy);
				snapDx = snap.dx;
				snapDy = snap.dy;
			} else {
				alignmentGuides = { vertical: [], horizontal: [] };
			}
			for (const [id, off] of touchState.offsets) {
				moveNode(id, {
					x: svgPos.x - off.dx + snapDx,
					y: svgPos.y - off.dy + snapDy
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

	function handleTouchEnd(e: TouchEvent) {
		clearLongPressTimer();

		if (draggingConnection) {
			const t = e.changedTouches[0];
			if (t) dropConnection(t.clientX, t.clientY);
			draggingConnection = null;
			hoveredNodeId = null;
			hoveredPortSide = null;
			return;
		}
		pendingMovePush = false;
		if (touchState?.type === 'drag') {
			diagram.localDraggingIds = new Set();
			diagram.flushMovePush();
			alignmentGuides = { vertical: [], horizontal: [] };
		}





		if (touchStartNodeId && !touchMoved) {
			const now = e.timeStamp;
			const isDoubleTap =
				lastTapNodeId === touchStartNodeId && now - lastNodeTapTime < DOUBLE_TAP_MS;
			if (isDoubleTap && diagram.selectedNodeIdSet.has(touchStartNodeId)) {
				if (diagram.diagramType === 'flowchart') startEditingFlowNode(touchStartNodeId);
				lastTapNodeId = null;
				lastNodeTapTime = 0;
			} else {
				lastTapNodeId = touchStartNodeId;
				lastNodeTapTime = now;
			}
		}
		touchStartNodeId = null;
		touchMoved = false;

		touchState = null;

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

<svelte:window
 onpointerdowncapture={(e) => {
  if (editingEntityId && !(e.target as Element)?.closest('[data-entity-name-editor]')) commitEntityEdit();
 }}
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
	onkeydown={(e) => { if (e.key === 'Alt') altHeld = true; }}
	onkeyup={(e) => { if (e.key === 'Alt') altHeld = false; }}
	onblur={() => { altHeld = false; panning = null; }}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={svgEl}
	data-onboarding="canvas"
	class="w-full h-full touch-canvas"
	xmlns="http://www.w3.org/2000/svg"
	role="img"
	aria-label="ER Diagram Canvas"
	onmousedowncapture={handleMiddleMouseDown}
	onmousedown={handleCanvasMouseDown}
	onauxclick={(e) => { if (e.button === 1) e.preventDefault(); }}
	onmousemove={handleCursorMove}
	onmouseleave={handleCursorLeave}
	ondragover={handleCanvasDragOver}
	data-diagram-canvas
	ondrop={handleCanvasDrop}
	oncontextmenu={(e) => e.preventDefault()}
	style="background: {colors.canvasBg}; cursor: {diagram.stampShape ? 'copy' : dragging || draggingNote ? 'grabbing' : panning ? 'move' : selecting ? 'crosshair' : 'default'}; touch-action: none;"
>

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

		<marker id="flow-arrow" viewBox="0 0 10 10" refX="10" refY="5"
			markerWidth="6" markerHeight="6" orient="auto-start-reverse">
			<path d="M 0 1 L 10 5 L 0 9" fill={colors.relationshipStroke} />
		</marker>

		<marker id="dfd-arrow" viewBox="0 0 10 10" refX="0" refY="5"
			markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
			<path d="M 0 0 L 10 5 L 0 10 Z" fill={colors.relationshipStroke} stroke="none" />
		</marker>

		<marker id="arrow-temp" viewBox="0 0 10 10" refX="10" refY="5"
			markerWidth="6" markerHeight="6" orient="auto-start-reverse">
			<path d="M 0 1 L 10 5 L 0 9" fill="#3b82f6" />
		</marker>
		<marker id="arrow-temp-valid" viewBox="0 0 10 10" refX="10" refY="5"
			markerWidth="6" markerHeight="6" orient="auto-start-reverse">
			<path d="M 0 1 L 10 5 L 0 9" fill="#10b981" />
		</marker>

		<filter id="dying-blur" x="-10%" y="-10%" width="120%" height="120%">
			<feGaussianBlur stdDeviation="0" />
		</filter>


		<filter id="sketch-wobble" x="-5%" y="-5%" width="110%" height="110%" filterUnits="objectBoundingBox">
			<feTurbulence type="fractalNoise" baseFrequency="0.012 0.014" numOctaves="2" seed="7" result="noise" />
			<feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
		</filter>
	</defs>


	<rect class="canvas-bg" width="100%" height="100%" fill={diagram.showGrid ? 'url(#grid-large)' : colors.canvasBg} />


	{#if alignmentGuides.vertical.length > 0 || alignmentGuides.horizontal.length > 0}
		<g transform="translate({diagram.panX}, {diagram.panY}) scale({diagram.zoom})" class="alignment-guides">
			{#each alignmentGuides.vertical as x}
				<line
					x1={x}
					y1={-10000}
					x2={x}
					y2={10000}
					stroke="#f59e0b"
					stroke-width="1"
					stroke-dasharray="4 4"
					opacity="0.6"
				/>
			{/each}
			{#each alignmentGuides.horizontal as y}
				<line
					x1={-10000}
					y1={y}
					x2={10000}
					y2={y}
					stroke="#f59e0b"
					stroke-width="1"
					stroke-dasharray="4 4"
					opacity="0.6"
				/>
			{/each}
		</g>
	{/if}


	<g transform="translate({diagram.panX}, {diagram.panY}) scale({diagram.zoom})" font-family={diagram.diagramFont} class="diagram-content" class:notation-out={diagram.notationTransitioning} class:notation-in={diagram.notationAppearing} class:notation-morph={diagram.notationMorphing} class:magic-arranging={diagram.animating} filter={diagram.sketchMode ? 'url(#sketch-wobble)' : undefined} style="will-change: transform;{diagram.smoothTransition && !panning ? ' transition: transform 0.3s ease-out;' : ''}">

		{#if diagram.showDataFlow && allParticlePaths.length > 0}
			<DataFlowParticles paths={allParticlePaths} />
		{/if}

		{#if diagram.diagramType === 'er'}

			<g class="rels-group">
			{#each visibleRelData as data}
				{#if diagram.notationRelPhase !== 'hidden'}
					{#if renderer.useDiamond}
						<ChenDiamond
							fromRect={data.fromRect}
							toRect={data.toRect}
							relationship={data.relationship}
							fromPoint={data.fromPoint}
							toPoint={data.toPoint}
							{renderer}
							selected={diagram.selectedEdgeId === data.relationship.id}
							highlighted={highlight.active && highlight.relationshipIds.has(data.relationship.id)}
							dying={diagram.dyingRelationshipIds.has(data.relationship.id) || diagram.notationRelPhase === 'undraw'}
							onclick={() => { if (!collab.isViewer) diagram.selectRelationship(data.relationship.id); }}
							ontouchstart={(e) => handleRelTouchStart(data.relationship.id, e)}
							animateIn={diagram.newRelationshipIds.has(data.relationship.id) || diagram.notationRelPhase === 'draw'}
						/>
					{:else}
						<RelationshipEdge
							relationship={data.relationship}
							fromPoint={data.fromPoint}
							toPoint={data.toPoint}
							fromRect={data.fromRect}
							toRect={data.toRect}
							obstacles={erRoutingObstacles}
							{renderer}
							notation={diagram.notation}
							selected={diagram.selectedEdgeId === data.relationship.id}
							highlighted={highlight.active && highlight.relationshipIds.has(data.relationship.id)}
							dimmed={diagram.focusMode && diagram.focusedRelIds != null && !diagram.focusedRelIds.has(data.relationship.id)}
							dying={diagram.dyingRelationshipIds.has(data.relationship.id) || diagram.notationRelPhase === 'undraw'}
							onclick={() => { if (!collab.isViewer) diagram.selectRelationship(data.relationship.id); }}
							ontouchstart={(e) => handleRelTouchStart(data.relationship.id, e)}
							animateIn={diagram.newRelationshipIds.has(data.relationship.id) || diagram.notationRelPhase === 'draw'}
						/>
					{/if}
				{/if}
			{/each}
			</g>


			{#if renderer.useOvalAttributes && (!diagram.notationMorphing || diagram.notationOvalsAppearing)}
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
								animateIn={diagram.notationOvalsAppearing}
							/>
						{/each}
					{/if}
				{/each}
			{/if}


			{#each visibleEntities as entity}
				{@const rect = entityRects.get(entity.id)}
				{#if rect}
					<EntityNode
						{entity}
						{rect}
						{renderer}
						selected={diagram.selectedNodeIdSet.has(entity.id)}
						highlighted={highlight.active && highlight.entityIds.has(entity.id)}
						dimmed={diagram.focusMode && diagram.focusedEntityIds != null && !diagram.focusedEntityIds.has(entity.id)}
						morphing={diagram.notationMorphing}
						onmousedown={(e) => handleEntityMouseDown(entity.id, e)}
						onclick={(e) => { if (!collab.isViewer && !e.shiftKey) diagram.selectEntity(entity.id); }}
						ontouchstart={(e) => handleEntityTouchStart(entity.id, e)}
						oncontextmenu={(e) => handleEntityContextMenu(entity.id, e)}
						onattributeedit={cancelEntityEdit}
						ondblclick={(e) => {
 const target = e.target as Element;
 if (target.closest('[data-attribute-text]')) { cancelEntityEdit(); return; }
 void handleEntityDblClick(entity.id);
}}
						animateIn={diagram.newEntityIds.has(entity.id)}
						dragging={dragging != null && dragging.offsets.has(entity.id)}
						remoteSelectors={collab.connected ? collab.remoteSelectionsByEntity.get(entity.id) : undefined}
					/>
					<CommentBadge targetId={entity.id} x={rect.x + rect.width} y={rect.y} />
					{#if diagram.selectedNodeIdSet.has(entity.id) && diagram.selectedNodeIds.length === 1 && !dragging && !panning && !resizing && !draggingConnection && !diagram.viewOnly && !collab.isViewer}
						<FlowConnectionHandles node={{ id: entity.id, position: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } }} W={rect.width} H={rect.height} isSelected onStartConnection={handleStartConnection} />
					{/if}

					{#if editingEntityId === entity.id}
						<foreignObject
							x={rect.x + 2}
							y={rect.y + 2}
							width={rect.width - 4}
							height={renderer.headerHeight - 4}
						>
							<!-- svelte-ignore a11y_use:focusEntityEditor -->
							<input
								use:focusEntityEditor
								type="text"
								style="
									width: 100%;
									height: 100%;
									border: none;
									outline: none;
									background: {colors.entityFill};
									color: {colors.entityHeaderText};
									font-size: {(entity.fontSize ?? diagram.diagramFontSize)}px;
									font-weight: {(entity.bold ?? true) ? 700 : 400};
									font-style: {entity.italic ? 'italic' : 'normal'};
									font-family: {diagram.diagramFont};
									text-align: center;
									padding: 0; margin: 0; min-height: 0; min-width: 0;
									box-sizing: border-box;
									border-radius: 2px;
								"
								data-entity-name-editor
								bind:value={editingEntityName}
								onblur={commitEntityEdit}
								onkeydown={(e) => {
									if (e.isComposing) return;
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


			{#if draggingConnection}
				<line x1={draggingConnection.startX} y1={draggingConnection.startY} x2={draggingConnection.currentX} y2={draggingConnection.currentY} stroke={colors.selectedStroke} stroke-width={2 / diagram.zoom} stroke-dasharray="6 4" pointer-events="none" />
				{#if hoveredNodeId && entityRects.get(hoveredNodeId)}
					{@const target = entityRects.get(hoveredNodeId)!}
					<rect x={target.x - 3} y={target.y - 3} width={target.width + 6} height={target.height + 6} fill="none" stroke={colors.selectedStroke} stroke-width={2 / diagram.zoom} pointer-events="none" />
				{/if}
			{/if}
			{#each diagram.dyingEntities as entity (entity.id)}
				{@const rect = entity._dyingRect ?? { x: entity.position.x, y: entity.position.y, width: 160, height: 80 }}
				{@const perimeter = 2 * (rect.width + rect.height)}
				<g class="dying-entity" style="--perimeter: {perimeter}; transform-origin: {rect.x + rect.width / 2}px {rect.y + rect.height / 2}px;">

					<rect
						class="dying-fill"
						x={rect.x}
						y={rect.y}
						width={rect.width}
						height={rect.height}
						fill={entity.color || colors.entityFill}
						stroke="none"
					/>

					<rect
						class="dying-border"
						x={rect.x}
						y={rect.y}
						width={rect.width}
						height={rect.height}
						fill="none"
						stroke={colors.entityStroke}
						stroke-width="2"
						stroke-dasharray={perimeter}
					/>

					<line
						class="dying-header-line"
						x1={rect.x}
						y1={rect.y + 32}
						x2={rect.x + rect.width}
						y2={rect.y + 32}
						stroke={colors.entityStroke}
						stroke-width="1"
						stroke-dasharray={rect.width}
					/>

					<text
						class="dying-text"
						x={rect.x + rect.width / 2}
						y={rect.y + 16}
						text-anchor="middle"
						dominant-baseline="central"
						fill={colors.entityHeaderText}
						font-size="14"
						font-weight="700"
					>{entity.name}</text>
				</g>
			{/each}

		{:else if diagram.diagramType === 'flowchart'}

			{#each diagram.flowEdges as edge (edge.id)}
				{@const fromNode = diagram.flowNodes.find(n => n.id === edge.fromNodeId)}
				{@const toNode = diagram.flowNodes.find(n => n.id === edge.toNodeId)}
				{#if fromNode && toNode}
					{@const selected = diagram.selectedEdgeId === edge.id || diagram.selectedFlowEdgeIds.includes(edge.id)}
					<FlowEdgeLine
						{edge}
						{fromNode}
						{toNode}
						offset={flowEdgeOffsets.get(edge.id) ?? 0}
						{selected}
						dying={diagram.dyingFlowEdgeIds.has(edge.id)}
						obstacles={diagram.smartRouting ? diagram.flowNodes : undefined}
						ports={flowPorts.get(edge.id)}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(edge.id); }}
						onlinemousedown={(e) => handleFlowEdgeMouseDown(edge.id, e)}
						onlinetouchstart={(e) => handleEdgeTouchStart(edge.id, e)}
					/>



				{/if}
			{/each}





			{#each diagram.dyingFlowNodes as node (node.id)}
				<FlowNodeShape {node} dying={true} />
			{/each}


			{#each diagram.flowNodes as node (node.id)}
				{@const isDying = diagram.dyingFlowNodes.some(d => d.id === node.id)}
				{#if !isDying}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g
						onmouseenter={() => hoveredFlowNodeId = node.id}
						onmouseleave={() => hoveredFlowNodeId = null}
					>

						<FlowNodeShape
							{node}
							selected={diagram.selectedNodeIdSet.has(node.id)}
							editing={editingLabel?.nodeId === node.id}
							onmousedown={(e) => handleEntityMouseDown(node.id, e)}
							onclick={(e) => { if (!collab.isViewer && !e.shiftKey) diagram.selectEntity(node.id); }}
							ontouchstart={(e) => handleEntityTouchStart(node.id, e)}
							oncontextmenu={(e) => handleEntityContextMenu(node.id, e)}
							onStartEdit={startEditingFlowNode}
							animateIn={diagram.newEntityIds.has(node.id)}
							{altHeld}
							onWordMouseDown={(wordIndex, e) => handleWordMouseDown(node.id, wordIndex, e)}
						/>
						{#if editingLabel?.nodeId === node.id && editingLabel.node}
							<InNodeTextEditor
								x={editingLabel.node.x}
								y={editingLabel.node.y}
								width={editingLabel.node.width}
								height={editingLabel.node.height}
								fontSize={editingLabel.node.fontSize}
								fontWeight={editingLabel.node.fontWeight}
								fontStyle={editingLabel.node.fontStyle}
								color={editingLabel.node.color}
								fontFamily={diagram.diagramFont}
								bind:text={editingLabel.text}
								onSave={saveInlineEdit}
								onCancel={cancelInlineEdit}
							/>
						{/if}
						<CommentBadge
							targetId={node.id}
							x={node.position.x + (node.width || (node.type === 'connector' ? 28 : 140)) / 2}
							y={node.position.y - (node.height || (node.type === 'connector' ? 28 : 60)) / 2}
						/>


						{#if (hoveredFlowNodeId === node.id || (isTouchDevice && diagram.selectedNodeIdSet.has(node.id) && diagram.selectedNodeIds.length === 1)) && !((node.type === 'connector' || node.type === 'circle' || node.type === 'square') && diagram.selectedNodeIdSet.has(node.id) && Math.min(node.width || 50, node.height || 50) < 60) && !dragging && !panning && !draggingConnection && !resizing && !collab.isViewer && !diagram.viewOnly}
							<FlowConnectionHandles
								{node}
								W={node.width || (node.type === 'connector' ? 28 : 140)}
								H={node.height || (node.type === 'connector' ? 28 : 60)}
								isSelected={diagram.selectedNodeIdSet.has(node.id)}
								onStartConnection={handleStartConnection}
							/>
						{/if}


						{#if diagram.selectedNodeIdSet.has(node.id) && !dragging && !panning && !draggingConnection && !collab.isViewer && !diagram.viewOnly}
							<ResizeHandles
                                edgesOnly={true}
								{node}
								touch={isTouchDevice}
								onStartResize={(handle, e) => handleResizeStart(node.id, handle, e)}
								onResizeMove={handleResizeMove}
								onResizeEnd={handleResizeEnd}
							/>
						{/if}
					</g>
				{/if}
			{/each}


			{#if draggingConnection && hoveredNodeId}
				{@const tn = diagram.flowNodes.find(n => n.id === hoveredNodeId)}
				{#if tn}
					{#each (['top', 'right', 'bottom', 'left'] as Side[]) as ps}
						{@const pp = getFlowPort(tn, ps)}
						{@const active = hoveredPortSide === ps}
                        {#if active}
                            <circle cx={pp.x} cy={pp.y} r={8 / diagram.zoom} fill="#10b981" fill-opacity="0.12" stroke="#10b981" stroke-opacity="0.35" stroke-width={1 / diagram.zoom} pointer-events="none" />
                            <circle cx={pp.x} cy={pp.y} r={3 / diagram.zoom} fill="#10b981" stroke={colors.canvasBg} stroke-width={1 / diagram.zoom} pointer-events="none" />
                        {/if}
					{/each}
				{/if}
			{/if}


			{#if draggingConnection}
				{@const s = { x: draggingConnection!.startX, y: draggingConnection!.startY }}
				{@const cur = { x: draggingConnection!.currentX, y: draggingConnection!.currentY }}
				{@const fromSide = draggingConnection!.fromSide}
				{@const tn = hoveredNodeId ? diagram.flowNodes.find(n => n.id === hoveredNodeId) : null}
				{@const fromNode = diagram.flowNodes.find(n => n.id === draggingConnection!.fromNodeId)}
				{@const tempRoute =
					tn && fromNode && hoveredPortSide
						? getFlowEdgeRoute(
								{ fromSide, toSide: hoveredPortSide },
								fromNode,
								tn,
								0
							)
						: routeFromPortToPoint(s, fromSide, cur)}
				<path
					d={tempRoute.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
					stroke={hoveredNodeId ? '#10b981' : '#3b82f6'}
					stroke-width={1.5 / diagram.zoom}
					stroke-dasharray={`${5 / diagram.zoom} ${3 / diagram.zoom}`}
					fill="none"
					opacity="0.7"
					marker-end={hoveredNodeId ? 'url(#arrow-temp-valid)' : 'url(#arrow-temp)'}
				/>
			{/if}

            {#if diagram.selectedEdgeId && !diagram.viewOnly && !collab.isViewer}
                {@const edge = diagram.flowEdges.find(e => e.id === diagram.selectedEdgeId)}
                {@const from = edge && diagram.flowNodes.find(n => n.id === edge.fromNodeId)}
                {@const to = edge && diagram.flowNodes.find(n => n.id === edge.toNodeId)}
                {#if edge && from && to}
                    <FlowEdgeTools {edge} route={getFlowEdgeRoute(edge, from, to, flowEdgeOffsets.get(edge.id) ?? 0, diagram.smartRouting ? diagram.flowNodes : undefined, flowPorts.get(edge.id))} />
                {/if}
            {/if}

		{:else if diagram.diagramType === 'context'}

			{#each diagram.dfdVisibleFlows as flow (flow.id)}
				{@const fromNode = diagram.dfdNodes.find(n => n.id === flow.fromNodeId)}
				{@const toNode = diagram.dfdNodes.find(n => n.id === flow.toNodeId)}
				{#if fromNode && toNode}
					{@const selected = diagram.selectedEdgeId === flow.id}
					{@const autoOffset = diagram.dfdFlowPortOffsets.get(flow.id)}
					<DFDFlowLine
						{flow}
						{fromNode}
						{toNode}
						{selected}
						routeOffset={autoOffset?.routeOffset}
						autoFromOffset={autoOffset?.from}
						autoToOffset={autoOffset?.to}
						labelT={autoOffset?.labelT}
						autoFromSide={autoOffset?.fromSide}
						autoToSide={autoOffset?.toSide}
						labelSide={autoOffset?.labelSide}
						animateIn={diagram.newDFDFlowIds.has(flow.id)}
						dying={diagram.dyingDFDFlowIds.has(flow.id)}
						onclick={() => { if (!collab.isViewer) diagram.selectRelationship(flow.id); }}
						ondblclick={() => startEditingDFDFlowLabel(flow.id)}
						onlinemousedown={(e) => handleDFDLineMouseDown(flow.id, e)}
						onlinetouchstart={(e) => handleEdgeTouchStart(flow.id, e)}
						onlabelmousedown={(e) => {
							if (collab.isViewer || diagram.viewOnly) return;
							const svgPos = screenToSvg(e.clientX, e.clientY);
							const lp = flow.labelPosition;
							draggingDFDLabel = {
								flowId: flow.id,
								offsetX: lp ? lp.x - svgPos.x : 0,
								offsetY: lp ? lp.y - svgPos.y : 0
							};
						}}
					/>
				{/if}
			{/each}


			{#each diagram.dfdVisibleNodes as node (node.id)}
				{@const dfdRect = getDFDNodeRect(node)}
				{@const hasChildren = diagram.dfdNodesWithChildren.has(node.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					onmouseenter={() => hoveredDFDNodeId = node.id}
					onmouseleave={() => hoveredDFDNodeId = null}
				>
					<DFDNodeShape
						{node}
						selected={diagram.selectedNodeIdSet.has(node.id)}
						onmousedown={(e) => handleEntityMouseDown(node.id, e)}
						onclick={(e) => { if (!collab.isViewer && !e.shiftKey) diagram.selectEntity(node.id); }}
						ontouchstart={(e) => handleEntityTouchStart(node.id, e)}
						oncontextmenu={(e) => handleEntityContextMenu(node.id, e)}
						ondblclick={() => handleDFDNodeDblClick(node.id)}
						animateIn={diagram.newEntityIds.has(node.id)}
					/>

					{#if node.type === 'process' && (hasChildren || hoveredDFDNodeId === node.id) && !collab.isViewer}
						<g
							class="dfd-drill-badge"
							role="button"
							tabindex="0"
							aria-label="เจาะดูระดับย่อย"
							transform="translate({dfdRect.x + dfdRect.w - 9}, {dfdRect.y + dfdRect.h - 9})"
							onclick={(e) => { e.stopPropagation(); handleDFDNodeDblClick(node.id); }}
							onkeydown={(e) => { if (e.key === 'Enter') handleDFDNodeDblClick(node.id); }}
							style="cursor: pointer;"
						>
							<circle r="9" fill={hasChildren ? colors.pkColor : colors.canvasBg} stroke={colors.entityStroke} stroke-width="1.2" />

							<path d="M -4.5 -1.5 L -4.5 -4.5 L -1.5 -4.5 M -4.5 -4.5 L -1 -1 M 4.5 1.5 L 4.5 4.5 L 1.5 4.5 M 4.5 4.5 L 1 1" fill="none" stroke={hasChildren ? colors.entityFill : colors.entityStroke} stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
						</g>
					{/if}
					<CommentBadge targetId={node.id} x={dfdRect.x + dfdRect.w} y={dfdRect.y} />


					{#if hoveredDFDNodeId === node.id && !dragging && !panning && !draggingConnection && !resizing && !collab.isViewer && !diagram.viewOnly}
						<FlowConnectionHandles
							{node}
							W={dfdRect.w}
							H={dfdRect.h}
							onStartConnection={handleStartConnection}
						/>
					{/if}
					{#if diagram.selectedNodeIdSet.has(node.id) && !collab.isViewer && !diagram.viewOnly}
						<ResizeHandles node={{ id: node.id, name: node.name, type: 'process', position: node.position, width: dfdRect.w, height: dfdRect.h }} edgesOnly touch={isTouchDevice} onStartResize={(handle, event) => handleResizeStart(node.id, handle, event)} onResizeMove={handleResizeMove} onResizeEnd={handleResizeEnd} />
					{/if}

				</g>
			{/each}



			{#each diagram.dyingDFDNodes as node (node.id)}
				<DFDNodeShape {node} dying={true} />
			{/each}


			{#if draggingConnection}
				{@const dc = draggingConnection}
				{@const source = diagram.dfdNodes.find(node => node.id === dc.fromNodeId)}
				{@const target = diagram.dfdNodes.find(node => node.id === hoveredNodeId)}
				{@const sourceRect = source ? getDFDNodeRect(source) : null}
				{@const targetRect = target ? getDFDNodeRect(target) : null}
				{@const tempRoute = source && target && sourceRect && targetRect && hoveredPortSide
					? getFlowEdgeRoute({ fromSide: dc.fromSide, toSide: hoveredPortSide }, { id: source.id, name: '', type: 'process', position: source.position, width: sourceRect.w, height: sourceRect.h }, { id: target.id, name: '', type: 'process', position: target.position, width: targetRect.w, height: targetRect.h }, 0)
					: routeFromPortToPoint({ x: dc.startX, y: dc.startY }, dc.fromSide, { x: dc.currentX, y: dc.currentY })}
				<path d={tempRoute.map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join(' ')} stroke={hoveredNodeId ? '#10b981' : '#3b82f6'} stroke-width={1.5 / diagram.zoom} stroke-dasharray={`${5 / diagram.zoom} ${3 / diagram.zoom}`} fill="none" opacity="0.7" marker-end={hoveredNodeId ? 'url(#arrow-temp-valid)' : 'url(#arrow-temp)'} />
			{/if}
		{/if}


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

				<rect
					width={noteW}
					height={noteH}
					rx="5"
					fill={c.bg}
					stroke={c.border}
					stroke-width="1.5"
				/>

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



		{#each (diagram.diagramType === 'er' ? [...diagram.entities, ...diagram.notes] : diagram.diagramType === 'flowchart' ? [...diagram.flowNodes, ...diagram.notes] : [...diagram.dfdVisibleNodes, ...diagram.notes]) as item (item.id)}
			{@const label = collab.lockLabel(item.id)}
			{#if label}
				<g pointer-events="none" transform="translate({item.position.x}, {item.position.y - 30})">
					<rect x="-8" y="-18" width={Math.max(160, label.length * 9)} height="26" rx="6" fill="#b45309" />
					<text fill="white" font-size="12" font-family="sans-serif"> {label}</text>
				</g>
			{/if}
		{/each}

		{#each remoteCursors as [clientId, cur] (clientId)}
			<RemoteCursor
				name={cur.name}
				color={cur.color}
				x={cur.x}
				y={cur.y}
				zoom={diagram.zoom}
			/>
		{/each}


		{#each ripples as ripple (ripple.id)}
			<circle
				class="ripple-circle"
				cx={ripple.x}
				cy={ripple.y}
				r="80"
				onanimationend={() => removeRipple(ripple.id)}
			/>
		{/each}
	</g>


	{#if (diagram.diagramType === 'er' && diagram.entities.length === 0) ||
		(diagram.diagramType === 'flowchart' && diagram.flowNodes.length === 0) ||
		(diagram.diagramType === 'context' && diagram.dfdVisibleNodes.length === 0)}
		<g transform="translate({diagram.canvasWidth / 2}, {diagram.canvasHeight / 2})">
		<g class="empty-state">

			<g transform="translate(-20, -48)" opacity="0.3">
				<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={colors.attrText}>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
				</svg>
			</g>

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


{#if editingLabel && editingLabel.rect && !editingLabel.nodeId}
	<InlineTextEditor
		bind:text={editingLabel.text}
		rect={editingLabel.rect}
		fontSize={editingLabel.fontSize}
		onSave={saveInlineEdit}
		onCancel={cancelInlineEdit}
	/>
{/if}


{#if contextMenu}
	<ContextMenu
		x={contextMenu.x}
		y={contextMenu.y}
		items={getContextMenuItems()}
		onclose={closeContextMenu}
	/>
{/if}


{#if connectMenu}
	<ContextMenu
		x={connectMenu.x}
		y={connectMenu.y}
		items={getConnectMenuItems()}
		onclose={closeConnectMenu}
	/>
{/if}

<style>
	/* Flow Simulation: pulsing ring around the node a token is visiting. */

	/* Notation switch: line undraw/draw at group level */

	/* Notation switch: entity shimmer */
	@keyframes notationShimmer {
		0%   { filter: brightness(1); }
		40%  { filter: brightness(1.1) drop-shadow(0 0 6px rgba(59,130,246,0.15)); }
		100% { filter: brightness(1); }
	}
	.diagram-content {
		opacity: 1;
	}
	.diagram-content.notation-out {
		/* Entities just shimmer slightly, not fade */
	}
	.diagram-content.notation-in {
		animation: notationShimmer 0.4s ease-out;
	}
	.diagram-content.magic-arranging :global(.entity-node) {
		filter: drop-shadow(0 0 8px rgba(59,130,246,0.4)) drop-shadow(0 0 3px rgba(59,130,246,0.2));
		transition: filter 0.3s ease;
	}


	@keyframes entityBorderUndraw {
		0%   { stroke-dashoffset: 0; opacity: 1; }
		70%  { opacity: 0.8; }
		100% { stroke-dashoffset: var(--perimeter); opacity: 0; }
	}
	@keyframes entityLineUndraw {
		0%   { stroke-dashoffset: 0; opacity: 1; }
		100% { stroke-dashoffset: var(--perimeter); opacity: 0; }
	}
	@keyframes entityFillFade {
		0%   { fill-opacity: 1; }
		30%  { fill-opacity: 0.5; }
		100% { fill-opacity: 0; }
	}
	@keyframes entityTextFade {
		0%   { opacity: 1; transform: translate(0, 0); }
		100% { opacity: 0; transform: translate(0, -4px); }
	}
	.dying-entity {
		pointer-events: none;
	}
	.dying-entity .dying-border {
		animation: entityBorderUndraw 0.8s ease-in forwards;
	}
	.dying-entity .dying-header-line {
		animation: entityLineUndraw 0.5s ease-in 0.1s forwards;
	}
	.dying-entity .dying-fill {
		animation: entityFillFade 0.6s ease-out forwards;
	}
	.dying-entity .dying-text {
		animation: entityTextFade 0.5s ease-in forwards;
	}
	@keyframes emptyStateIn {
		from { opacity: 0; transform: translate(0, 12px); }
		to { opacity: 1; transform: translate(0, 0); }
	}
	.empty-state {
		animation: emptyStateIn 0.5s ease-out;
	}

	/* Ripple effect */
	@keyframes rippleExpand {
		from { r: 0; opacity: 0.6; }
		to { r: 80; opacity: 0; }
	}
	.ripple-circle {
		fill: none;
		stroke: rgba(59, 130, 246, 0.5);
		stroke-width: 2;
		animation: rippleExpand 0.7s ease-out forwards;
		pointer-events: none;
	}
</style>
