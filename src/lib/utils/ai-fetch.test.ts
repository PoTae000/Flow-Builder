import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ auth: { isSignedIn: true, isAdmin: false, plan: 'basic', updatePlan: vi.fn() }, ui: { showUpgradeModal: false, loginRequested: false } }));
vi.mock('$lib/stores/auth.svelte', () => ({ auth: state.auth }));
vi.mock('$lib/stores/ui.svelte', () => ({ ui: state.ui }));
vi.mock('$lib/stores/session.svelte', () => ({ session: { activeDiagramId: 'test' } }));
vi.mock('$lib/stores/diagram.svelte', () => ({ diagram: { diagramType: 'er', dfdCurrentParentId: null } }));
vi.mock('$lib/stores/toast.svelte', () => ({ toast: { warning: vi.fn() } }));
import { aiFetch } from './ai-fetch';

describe('AI Pro access', () => {
	beforeEach(() => {
		state.auth.isSignedIn = true;
		state.auth.plan = 'basic';
		state.ui.showUpgradeModal = false;
		vi.stubGlobal('fetch', vi.fn());
	});
	it.each(['/api/chat', '/api/import', '/api/layout', '/api/suggest-improvement', '/api/agent/plan'])('blocks free access to %s before making a network request', async url => {
		const response = await aiFetch(url, { method: 'POST' });
		expect(response.status).toBe(403);
		expect(fetch).not.toHaveBeenCalled();
		expect(state.ui.showUpgradeModal).toBe(true);
	});
	it('blocks anonymous access before making a network request', async () => {
		state.auth.isSignedIn = false;
		expect((await aiFetch('/api/import')).status).toBe(401);
		expect(fetch).not.toHaveBeenCalled();
	});
});
