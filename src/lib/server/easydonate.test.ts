import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), fetch: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: { EASYDONATE_PAGE_URL: 'https://ezdn.app/potae_ja47', EASYDONATE_API_KEY: 'test-only', EASYDONATE_WEBHOOK_SECRET: 'test-only-secret', EASYDONATE_VERIFIED_SCHEMA: 'true' } }));
vi.mock('./db', () => ({ pool: { query: mocks.query, connect: async () => ({ query: mocks.query, release: mocks.release }) } }));
vi.mock('./rate-limit', () => ({ checkRateLimit: async () => ({ allowed: true }) }));
import { easyDonateConfig, reconcileEasyDonateOrder, validWebhookSecret } from './easydonate';
const order = { id: 'FB-AAAAAAAAAAAAAAAAAAAAAAAA', user_sub: 'user_1', status: 'pending', amount_satang: 24900, created_at: '2026-10-12T10:00:00Z', expires_at: '2026-10-13T10:00:00Z' };
const payment = { referenceNo: 'EZDN-paid', channelName: 'PROMPTPAY', donateMessage: order.id, amount: 249, createdAt: '2026-10-12T10:05:00Z' };
describe('EasyDonate Pro grants', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('fetch', mocks.fetch);
		mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT * FROM payment_orders') ? [order] : sql.includes('RETURNING plan_expires_at') ? [{ plan_expires_at: '2026-11-12T10:05:00Z' }] : [] }));
		mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: [payment] }) });
	});
	it('accepts the public EasyDonate short link', () => {
		expect(easyDonateConfig()).toMatchObject({ available: true, pageUrl: 'https://ezdn.app/potae_ja47' });
	});
	it('requires the webhook secret', () => {
		expect(validWebhookSecret('wrong')).toBe(false);
		expect(validWebhookSecret(null)).toBe(false);
		expect(validWebhookSecret('test-only-secret')).toBe(true);
	});
	it('opens Pro only after a server-side API lookup and commits atomically', async () => {
		expect(await reconcileEasyDonateOrder(order.id, 'user_1')).toMatchObject({ status: 'paid' });
		expect(mocks.fetch).toHaveBeenCalled();
		expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE payment_orders SET status = 'paid'"), [order.id, payment.referenceNo, new Date(payment.createdAt), '2026-11-12T10:05:00Z']);
		expect(mocks.query).toHaveBeenLastCalledWith('COMMIT');
	});
	it('cannot check an order belonging to another account', async () => {
		mocks.query.mockResolvedValue({ rows: [] });
		await expect(reconcileEasyDonateOrder(order.id, 'wrong')).rejects.toMatchObject({ status: 404 });
		expect(mocks.fetch).not.toHaveBeenCalled();
	});
	it('does not extend Pro twice for repeated notifications', async () => {
		mocks.query.mockResolvedValue({ rows: [{ ...order, status: 'paid' }] });
		await reconcileEasyDonateOrder(order.id);
		expect(mocks.fetch).not.toHaveBeenCalled();
		expect(mocks.query.mock.calls.some(([sql]) => sql.includes('UPDATE users'))).toBe(false);
	});
	it('does not grant access for a fabricated widget event', async () => {
		mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: [{ ...payment, channelName: 'EXTERNAL' }] }) });
		await reconcileEasyDonateOrder(order.id);
		expect(mocks.query.mock.calls.some(([sql]) => sql.includes('UPDATE users'))).toBe(false);
	});
	it.each([[401, 'ED_AUTH'], [403, 'ED_AUTH'], [429, 'ED_RATE_LIMIT'], [500, 'ED_UPSTREAM']])('reports provider HTTP %s without exposing credentials', async (status, code) => {
        mocks.fetch.mockResolvedValue({ ok: false, status });
        await expect(reconcileEasyDonateOrder(order.id)).rejects.toMatchObject({ body: { message: expect.stringContaining(code) } });
        expect(mocks.query.mock.calls.some(([sql]) => sql.includes('UPDATE users'))).toBe(false);
    });
    it('rejects an unverified response format with a useful diagnostic', async () => {
        mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { unexpected: [] } }) });
        await expect(reconcileEasyDonateOrder(order.id)).rejects.toMatchObject({ body: { message: expect.stringContaining('ED_SCHEMA') } });
    });
	it('rolls back the entitlement if the reference was already claimed', async () => {
		mocks.query.mockImplementation(async (sql: string) => {
			if (sql.includes('UPDATE payment_orders')) throw new Error('duplicate reference');
			return { rows: sql.includes('SELECT * FROM payment_orders') ? [order] : sql.includes('RETURNING plan_expires_at') ? [{ plan_expires_at: '2026-11-12T10:05:00Z' }] : [] };
		});
		await expect(reconcileEasyDonateOrder(order.id)).rejects.toThrow('duplicate reference');
		expect(mocks.query).toHaveBeenLastCalledWith('ROLLBACK');
		expect(mocks.release).toHaveBeenCalled();
	});
});
