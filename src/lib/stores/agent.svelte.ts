import { diagram } from '$lib/stores/diagram.svelte';
import { collab } from '$lib/stores/collab.svelte';
import type { AgentAction, AgentStep, AutoCompleteSuggestion } from '$lib/types/agent';
import type { CardinalityType } from '$lib/types/er';
import { generateId } from '$lib/utils/id';

export class AgentState {
	// Agent execution state
	running = $state(false);
	steps = $state<AgentStep[]>([]);
	agentGoal = $state('');
	private abortController: AbortController | null = null;
	private batchLabel = '';

	// Auto-complete state
	suggestions = $state<AutoCompleteSuggestion[]>([]);
	autoCompleteLoading = $state(false);
	private autoCompleteTimer: ReturnType<typeof setTimeout> | null = null;
	private lastAgentRunTime = 0;

	// --- Batch Undo ---

	beginBatch(label: string) {
		this.batchLabel = label;
		diagram.pushHistory(label);
		diagram._skipHistory = true;
	}

	endBatch() {
		diagram._skipHistory = false;
		// Push all changes to collab once at the end of the batch
		if (collab.connected) {
			collab.pushFullState();
		}
	}

	// --- Action Applier ---

	applyActions(actions: AgentAction[]) {
		for (const action of actions) {
			this.applyAction(action);
		}
	}

	private applyAction(action: AgentAction) {
		switch (action.op) {
			case 'add-entity': {
				const entity = diagram.addEntity(action.name);
				if (action.isWeak) {
					diagram.updateEntity(entity.id, { isWeak: true });
				}
				if (action.attributes?.length) {
					for (const attr of action.attributes) {
						diagram.addAttribute(entity.id, { name: attr.name, type: attr.type });
					}
				}
				break;
			}
			case 'remove-entity': {
				const entity = diagram.entities.find(e => e.name.toLowerCase() === action.name.toLowerCase());
				if (entity) diagram.removeEntity(entity.id);
				break;
			}
			case 'rename-entity': {
				const entity = diagram.entities.find(e => e.name.toLowerCase() === action.name.toLowerCase());
				if (entity) diagram.updateEntity(entity.id, { name: action.newName });
				break;
			}
			case 'add-attribute': {
				const entity = diagram.entities.find(e => e.name.toLowerCase() === action.entityName.toLowerCase());
				if (entity) {
					diagram.addAttribute(entity.id, { name: action.attribute.name, type: action.attribute.type });
				}
				break;
			}
			case 'remove-attribute': {
				const entity = diagram.entities.find(e => e.name.toLowerCase() === action.entityName.toLowerCase());
				if (entity) {
					const attr = entity.attributes.find(a => a.name.toLowerCase() === action.attributeName.toLowerCase());
					if (attr) diagram.removeAttribute(entity.id, attr.id);
				}
				break;
			}
			case 'add-relationship': {
				const fromEntity = diagram.entities.find(e => e.name.toLowerCase() === action.from.toLowerCase());
				const toEntity = diagram.entities.find(e => e.name.toLowerCase() === action.to.toLowerCase());
				if (fromEntity && toEntity) {
					const rel = diagram.addRelationship(
						action.name,
						[fromEntity.id, toEntity.id],
						[action.cardFrom as CardinalityType, action.cardTo as CardinalityType]
					);
					if (rel && action.isIdentifying) {
						diagram.updateRelationship(rel.id, { isIdentifying: true });
					}
				}
				break;
			}
			case 'remove-relationship': {
				const rel = diagram.relationships.find(r => r.name.toLowerCase() === action.name.toLowerCase());
				if (rel) diagram.removeRelationship(rel.id);
				break;
			}
			case 'modify-relationship': {
				const rel = diagram.relationships.find(r => r.name.toLowerCase() === action.name.toLowerCase());
				if (rel && action.updates) {
					const updates: Parameters<typeof diagram.updateRelationship>[1] = {};
					if (action.updates.name) updates.name = action.updates.name;
					if (action.updates.cardFrom && action.updates.cardTo) {
						updates.cardinalities = [
							action.updates.cardFrom as CardinalityType,
							action.updates.cardTo as CardinalityType
						];
					}
					if (action.updates.isIdentifying !== undefined) {
						updates.isIdentifying = action.updates.isIdentifying;
					}
					diagram.updateRelationship(rel.id, updates);
				}
				break;
			}
			case 'add-flow-node': {
				diagram.addFlowNode(action.name, action.type);
				break;
			}
			case 'remove-flow-node': {
				const node = diagram.flowNodes.find(n => n.name.toLowerCase() === action.name.toLowerCase());
				if (node) diagram.removeFlowNode(node.id);
				break;
			}
			case 'add-flow-edge': {
				const fromNode = diagram.flowNodes.find(n => n.name.toLowerCase() === action.fromNode.toLowerCase());
				const toNode = diagram.flowNodes.find(n => n.name.toLowerCase() === action.toNode.toLowerCase());
				if (fromNode && toNode) {
					diagram.addFlowEdge(action.label, fromNode.id, toNode.id, action.condition);
				}
				break;
			}
			case 'remove-flow-edge': {
				const fromNode = diagram.flowNodes.find(n => n.name.toLowerCase() === action.fromNode.toLowerCase());
				const toNode = diagram.flowNodes.find(n => n.name.toLowerCase() === action.toNode.toLowerCase());
				if (fromNode && toNode) {
					const edge = diagram.flowEdges.find(e => e.fromNodeId === fromNode.id && e.toNodeId === toNode.id);
					if (edge) diagram.removeFlowEdge(edge.id);
				}
				break;
			}
			case 'add-dfd-node': {
				const node = diagram.addDFDNode(action.name, action.type);
				if (action.processNumber) {
					diagram.updateDFDNode(node.id, { processNumber: action.processNumber });
				}
				if (action.storeNumber) {
					diagram.updateDFDNode(node.id, { storeNumber: action.storeNumber });
				}
				break;
			}
			case 'remove-dfd-node': {
				const node = diagram.dfdNodes.find(n => n.name.toLowerCase() === action.name.toLowerCase());
				if (node) diagram.removeDFDNode(node.id);
				break;
			}
			case 'add-dfd-flow': {
				const fromNode = diagram.dfdNodes.find(n => n.name.toLowerCase() === action.fromNode.toLowerCase());
				const toNode = diagram.dfdNodes.find(n => n.name.toLowerCase() === action.toNode.toLowerCase());
				if (fromNode && toNode) {
					diagram.addDFDFlow(action.label, fromNode.id, toNode.id);
				}
				break;
			}
			case 'remove-dfd-flow': {
				const fromNode = diagram.dfdNodes.find(n => n.name.toLowerCase() === action.fromNode.toLowerCase());
				const toNode = diagram.dfdNodes.find(n => n.name.toLowerCase() === action.toNode.toLowerCase());
				if (fromNode && toNode) {
					const flow = diagram.dfdFlows.find(f => f.fromNodeId === fromNode.id && f.toNodeId === toNode.id);
					if (flow) diagram.removeDFDFlow(flow.id);
				}
				break;
			}
			case 'auto-layout': {
				diagram.autoLayout();
				break;
			}
		}
	}

	// --- Autonomous Agent ---

	async executeAgent(goal: string) {
		if (this.running) return;
		this.running = true;
		this.agentGoal = goal;
		this.steps = [];
		this.abortController = new AbortController();

		try {
			this.beginBatch('Agent: ' + goal);

			// Step 1: Get plan
			const planRes = await fetch('/api/agent/plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					goal,
					diagramType: diagram.diagramType,
					currentDiagram: this.buildCurrentDiagramPayload()
				}),
				signal: this.abortController.signal
			});

			if (!planRes.ok) throw new Error('Planning failed');
			const planData = await planRes.json();
			const planSteps: { label: string; instruction: string }[] = planData.steps || [];

			this.steps = planSteps.map((s, i) => ({
				id: generateId(),
				label: s.label,
				status: 'pending' as const
			}));

			// Step 2: Execute each step
			for (let i = 0; i < planSteps.length; i++) {
				if (this.abortController.signal.aborted) break;

				this.steps[i].status = 'running';
				this.steps = [...this.steps]; // trigger reactivity

				try {
					// Auto-layout step is local
					if (planSteps[i].instruction === 'auto-layout') {
						diagram.autoLayout();
						this.steps[i].status = 'done';
						this.steps[i].actions = [{ op: 'auto-layout' }];
					} else {
						const stepRes = await fetch('/api/agent/execute-step', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								instruction: planSteps[i].instruction,
								diagramType: diagram.diagramType,
								currentDiagram: this.buildCurrentDiagramPayload()
							}),
							signal: this.abortController.signal
						});

						if (!stepRes.ok) throw new Error(`Step ${i + 1} failed`);
						const stepData = await stepRes.json();
						const actions: AgentAction[] = stepData.actions || [];

						this.applyActions(actions);
						this.steps[i].status = 'done';
						this.steps[i].actions = actions;
					}
				} catch (err: any) {
					this.steps[i].status = 'error';
					this.steps[i].error = err?.message || 'Unknown error';
					this.steps = [...this.steps];
					break;
				}

				this.steps = [...this.steps];

				// Small delay between steps for UX
				if (i < planSteps.length - 1) {
					await new Promise(r => setTimeout(r, 500));
				}
			}
		} catch (err: any) {
			// Plan-level error
			if (err?.name !== 'AbortError') {
				this.steps = [{
					id: generateId(),
					label: 'วางแผนล้มเหลว',
					status: 'error',
					error: err?.message || 'Unknown error'
				}];
			}
		} finally {
			this.endBatch();
			this.running = false;
			this.lastAgentRunTime = Date.now();
			this.abortController = null;
		}
	}

	cancelAgent() {
		if (this.abortController) {
			this.abortController.abort();
		}
	}

	undoAgent() {
		diagram.undo();
		this.steps = [];
		this.agentGoal = '';
	}

	// --- Auto-complete ---

	triggerAutoComplete(recentAction?: string) {
		// Suppress for 30s after agent run
		if (Date.now() - this.lastAgentRunTime < 30_000) return;
		if (this.running) return;

		// Debounce 3s
		if (this.autoCompleteTimer) clearTimeout(this.autoCompleteTimer);
		this.autoCompleteTimer = setTimeout(() => {
			this.autoCompleteTimer = null;
			this.fetchAutoComplete(recentAction);
		}, 3000);
	}

	private async fetchAutoComplete(recentAction?: string) {
		const nodeCount = diagram.diagramType === 'er'
			? diagram.entities.length
			: diagram.diagramType === 'flowchart'
				? diagram.flowNodes.length
				: diagram.dfdNodes.length;

		if (nodeCount < 1) return;

		this.autoCompleteLoading = true;
		try {
			const res = await fetch('/api/agent/auto-complete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					diagramType: diagram.diagramType,
					...this.buildCurrentDiagramPayload(),
					recentAction: recentAction || 'added new item'
				})
			});

			if (res.ok) {
				const data = await res.json();
				this.suggestions = (data.suggestions || []).map((s: any) => ({
					id: generateId(),
					label: s.label || s.name || 'Suggestion',
					description: s.description || '',
					actions: s.actions || []
				}));
			}
		} catch {
			// Silently fail
		} finally {
			this.autoCompleteLoading = false;
		}
	}

	acceptSuggestion(id: string) {
		const suggestion = this.suggestions.find(s => s.id === id);
		if (!suggestion) return;

		diagram.pushHistory('Auto-complete');
		this.applyActions(suggestion.actions);
		this.suggestions = this.suggestions.filter(s => s.id !== id);
	}

	dismissSuggestions() {
		this.suggestions = [];
	}

	// --- Helpers ---

	private buildCurrentDiagramPayload(): Record<string, any> {
		if (diagram.diagramType === 'flowchart') {
			return {
				flowNodes: diagram.flowNodes.map(n => ({ name: n.name, type: n.type })),
				flowEdges: diagram.flowEdges.map(e => {
					const from = diagram.flowNodes.find(n => n.id === e.fromNodeId);
					const to = diagram.flowNodes.find(n => n.id === e.toNodeId);
					return { label: e.label, fromNode: from?.name || '', toNode: to?.name || '', condition: e.condition };
				})
			};
		}
		if (diagram.diagramType === 'context') {
			return {
				dfdNodes: diagram.dfdNodes.map(n => ({ name: n.name, type: n.type, processNumber: n.processNumber, storeNumber: n.storeNumber })),
				dfdFlows: diagram.dfdFlows.map(f => {
					const from = diagram.dfdNodes.find(n => n.id === f.fromNodeId);
					const to = diagram.dfdNodes.find(n => n.id === f.toNodeId);
					return { label: f.label, fromNode: from?.name || '', toNode: to?.name || '' };
				})
			};
		}
		return {
			entities: diagram.entities.map(e => ({
				name: e.name,
				attributes: e.attributes.map(a => ({ name: a.name, type: a.type })),
				isWeak: e.isWeak
			})),
			relationships: diagram.relationships.map(r => {
				const from = diagram.entities.find(e => e.id === r.entityIds[0]);
				const to = diagram.entities.find(e => e.id === r.entityIds[1]);
				return {
					name: r.name,
					from: from?.name || '',
					to: to?.name || '',
					cardFrom: r.cardinalities[0],
					cardTo: r.cardinalities[1],
					isIdentifying: r.isIdentifying
				};
			})
		};
	}
}

export const agent = new AgentState();
