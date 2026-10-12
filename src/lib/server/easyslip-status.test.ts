import { describe, expect, it, vi } from 'vitest';
vi.mock('$env/dynamic/private', () => ({ env: {} }));
import { easySlipReady } from './easyslip-status';
const now = Date.parse('2026-10-12T12:00:00Z');
const app = { quota: { max: 250, remaining: 1 }, autoRenew: { expiresAt: '2026-11-12T12:00:00Z' } };
const response = (application = app, active = true) => ({ success: true, data: { branch: { isActive: active }, application } });
describe('EasySlip checkout availability', () => {
	it('allows an active unexpired branch with quota', () => expect(easySlipReady(response(), now)).toBe(true));
	it('allows explicitly unlimited quota', () => expect(easySlipReady(response({ ...app, quota: { max: null, remaining: null } } as unknown as typeof app), now)).toBe(true));
	it('blocks exhausted quota even with automatic renewal enabled', () => expect(easySlipReady(response({ ...app, quota: { max: 250, remaining: 0 } }), now)).toBe(false));
	it('blocks expired packages', () => expect(easySlipReady(response({ ...app, autoRenew: { expiresAt: '2026-10-12T11:59:59Z' } }), now)).toBe(false));
	it('blocks inactive branches', () => expect(easySlipReady(response(app, false), now)).toBe(false));
	it.each([null, {}, { success: false }, { success: true, data: {} }, response({ ...app, autoRenew: { expiresAt: 'invalid' } })])('fails closed for malformed or unsuccessful status', value => expect(easySlipReady(value, now)).toBe(false));
});
