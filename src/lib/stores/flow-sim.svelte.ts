












import type { FlowNode, FlowEdge } from '$lib/types/flowchart';


interface Token {
	edgeId: string;
	fromNodeId: string;
	toNodeId: string;
	t: number;
}


const EDGE_DURATION = 1.6;

const NODE_GLOW = 1.1;

const MAX_PASSES = 2;

class FlowSimStore {
	running = $state(false);
	nodeProgress = $state<Map<string, number>>(new Map());
	private nodeEnteredAt = new Map<string, number>();

	edgeProgress = $state<Map<string, number>>(new Map());

	activeNodeIds = $state<Set<string>>(new Set());

	visitedNodeIds = $state<Set<string>>(new Set());

	traversedEdgeIds = $state<Set<string>>(new Set());
	loop = $state(true);

	private tokens: Token[] = [];
	private departures: { nodeId: string; at: number }[] = [];
	private outgoing = new Map<string, FlowEdge[]>();
	private edgePasses = new Map<string, number>();
	private nodeGlowUntil = new Map<string, number>();
	private startNodeId: string | null = null;
	private raf = 0;
	private lastTs = 0;
	private clock = 0;
	private idleSince = 0;


	canSimulate(nodes: FlowNode[], edges: FlowEdge[]): boolean {
		return nodes.length > 0 && edges.length > 0;
	}


	private findStart(nodes: FlowNode[], edges: FlowEdge[]): string | null {
		if (!nodes.length) return null;
		const hasIncoming = new Set(edges.map((e) => e.toNodeId));
		const roots = nodes.filter((n) => !hasIncoming.has(n.id));
		const startShape = roots.find((n) => n.type === 'start-end') ?? roots[0];
		return (startShape ?? nodes[0]).id;
	}

	start(nodes: FlowNode[], edges: FlowEdge[]) {
		this.stop();
		if (!this.canSimulate(nodes, edges)) return;


		this.outgoing = new Map();
		for (const e of edges) {
			const list = this.outgoing.get(e.fromNodeId) ?? [];
			list.push(e);
			this.outgoing.set(e.fromNodeId, list);
		}
		this.edgePasses = new Map();
		this.nodeGlowUntil = new Map();
		this.tokens = [];
		this.departures = [];
		this.edgeProgress = new Map();
		this.activeNodeIds = new Set();
		this.visitedNodeIds = new Set();
		this.nodeEnteredAt = new Map();
		this.nodeProgress = new Map();
		this.traversedEdgeIds = new Set();
		this.clock = 0;
		this.idleSince = 0;
		this.lastTs = 0;

		this.startNodeId = this.findStart(nodes, edges);
		if (!this.startNodeId) return;

		this.running = true;
		this.enterNode(this.startNodeId);
		this.raf = requestAnimationFrame((ts) => this.tick(ts));
	}


	private enterNode(nodeId: string) {
		this.nodeEnteredAt.set(nodeId, this.clock);
		this.visitedNodeIds.add(nodeId);
		this.visitedNodeIds = new Set(this.visitedNodeIds);
		this.nodeGlowUntil.set(nodeId, this.clock + NODE_GLOW);

		this.departures.push({ nodeId, at: this.clock + 0.75 });
	}

	private leaveNode(nodeId: string) {
		const edges = this.outgoing.get(nodeId) ?? [];
		for (const e of edges) {
			const passes = this.edgePasses.get(e.id) ?? 0;
			if (passes >= MAX_PASSES) continue;
			this.edgePasses.set(e.id, passes + 1);
			this.tokens.push({ edgeId: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, t: 0 });
		}
	}

	private tick(ts: number) {
		if (!this.running) return;
		if (!this.lastTs) this.lastTs = ts;
		let dt = (ts - this.lastTs) / 1000;
		this.lastTs = ts;
		if (dt > 0.1) dt = 0.1;
		this.clock += dt;
		this.nodeProgress = new Map([...this.nodeEnteredAt].map(([id, at]) => [id, Math.min(1, (this.clock - at) / 0.75)]));

		const ready = this.departures.filter(item => item.at <= this.clock);
		this.departures = this.departures.filter(item => item.at > this.clock);
		for (const item of ready) this.leaveNode(item.nodeId);

		const step = dt / EDGE_DURATION;
		const arrivals: Token[] = [];
		const survivors: Token[] = [];
		for (const tok of this.tokens) {
			tok.t += step;
			if (tok.t >= 1) arrivals.push(tok);
			else survivors.push(tok);
		}
		this.tokens = survivors;

		for (const tok of arrivals) {
			this.traversedEdgeIds.add(tok.edgeId);
			this.enterNode(tok.toNodeId);
		}
		if (arrivals.length) this.traversedEdgeIds = new Set(this.traversedEdgeIds);


		const prog = new Map<string, number>();
		for (const tok of this.tokens) {

			prog.set(tok.edgeId, Math.max(prog.get(tok.edgeId) ?? 0, tok.t));
		}
		this.edgeProgress = prog;


		const active = new Set<string>();
		for (const [nodeId, until] of this.nodeGlowUntil) {
			if (until > this.clock) active.add(nodeId);
		}
		this.activeNodeIds = active;


		if (this.tokens.length === 0 && this.departures.length === 0 && active.size === 0) {
			if (!this.idleSince) this.idleSince = this.clock;
			if (this.loop && this.clock - this.idleSince > 0.6 && this.startNodeId) {

				this.edgePasses = new Map();
				this.traversedEdgeIds = new Set();
				this.visitedNodeIds = new Set();
		this.nodeEnteredAt = new Map();
		this.nodeProgress = new Map();
				this.idleSince = 0;
				this.enterNode(this.startNodeId);
			} else if (!this.loop) {
				this.stop();
				return;
			}
		} else {
			this.idleSince = 0;
		}

		this.raf = requestAnimationFrame((t) => this.tick(t));
	}

	stop() {
		this.running = false;
		this.nodeProgress = new Map();
		this.nodeEnteredAt = new Map();
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = 0;
		this.lastTs = 0;
		this.tokens = [];
		this.departures = [];
		this.edgeProgress = new Map();
		this.activeNodeIds = new Set();
	}


	reset() {
		this.stop();
		this.visitedNodeIds = new Set();
		this.nodeEnteredAt = new Map();
		this.nodeProgress = new Map();
		this.traversedEdgeIds = new Set();
	}

	toggle(nodes: FlowNode[], edges: FlowEdge[]) {
		if (this.running) this.stop();
		else this.start(nodes, edges);
	}
}

export const flowSim = new FlowSimStore();
