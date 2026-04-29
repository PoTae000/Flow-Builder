class HighlightState {
	entityIds = $state<Set<string>>(new Set());
	relationshipIds = $state<Set<string>>(new Set());
	columnsByEntity = $state<Map<string, string[]>>(new Map());

	active = $derived(this.entityIds.size > 0 || this.relationshipIds.size > 0);

	setHighlights(
		entityIds: Set<string>,
		relationshipIds: Set<string>,
		columnsByEntity?: Map<string, string[]>
	) {
		this.entityIds = entityIds;
		this.relationshipIds = relationshipIds;
		this.columnsByEntity = columnsByEntity ?? new Map();
	}

	clear() {
		this.entityIds = new Set();
		this.relationshipIds = new Set();
		this.columnsByEntity = new Map();
	}
}

export const highlight = new HighlightState();
