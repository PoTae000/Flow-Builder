/** Presentation mode state — shared between PresentationMode controls and DiagramCanvas */
class PresentationState {
	active = $state(false);
	visibleEntityIds = $state<Set<string>>(new Set());
	visibleRelIds = $state<Set<string>>(new Set());
	newlyRevealedEntityIds = $state<Set<string>>(new Set());
	newlyRevealedRelIds = $state<Set<string>>(new Set());

	/** Camera position saved before presentation starts, restored on stop */
	savedView: { panX: number; panY: number; zoom: number } | null = null;

	start(panX: number, panY: number, zoom: number) {
		this.savedView = { panX, panY, zoom };
		this.active = true;
		this.visibleEntityIds = new Set();
		this.visibleRelIds = new Set();
		this.newlyRevealedEntityIds = new Set();
		this.newlyRevealedRelIds = new Set();
	}

	stop(): { panX: number; panY: number; zoom: number } | null {
		this.active = false;
		this.visibleEntityIds = new Set();
		this.visibleRelIds = new Set();
		this.newlyRevealedEntityIds = new Set();
		this.newlyRevealedRelIds = new Set();
		const view = this.savedView;
		this.savedView = null;
		return view;
	}

	setVisible(entityIds: Set<string>, relIds: Set<string>) {
		this.newlyRevealedEntityIds = new Set(
			[...entityIds].filter(id => !this.visibleEntityIds.has(id))
		);
		this.newlyRevealedRelIds = new Set(
			[...relIds].filter(id => !this.visibleRelIds.has(id))
		);
		this.visibleEntityIds = entityIds;
		this.visibleRelIds = relIds;
	}

	clearNewlyRevealed() {
		this.newlyRevealedEntityIds = new Set();
		this.newlyRevealedRelIds = new Set();
	}
}

export const presentation = new PresentationState();
