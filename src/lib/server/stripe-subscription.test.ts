import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), query: vi.fn(), release: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: { STRIPE_PRICE_ID: 'price_pro' } }));
vi.mock('./stripe', () => ({ stripe: { subscriptions: { retrieve: mocks.retrieve } } }));
vi.mock('./db', () => ({ pool: { connect: async () => ({ query: mocks.query, release: mocks.release }) } }));
import { subscriptionAccess, syncStripeSubscription } from './stripe-subscription';

function subscription(status = 'active', invoiceStatus = 'paid', price = 'price_pro'): Stripe.Subscription {
	return { id: 'sub_1', customer: 'cus_1', status, cancel_at_period_end: false,
		items: { data: [{ price: { id: price }, current_period_end: 2000000000 }] },
		latest_invoice: { status: invoiceStatus } } as unknown as Stripe.Subscription;
}

describe('Stripe Pro access', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT sub') ? [{ sub: 'user_1' }] : sql.includes('MAX(') ? [{ expires_at: null }] : [] }));
		mocks.retrieve.mockResolvedValue(subscription());
	});
	it('grants Pro only for the paid configured subscription', () => {
		expect(subscriptionAccess(subscription(), 'price_pro', 1000).entitled).toBe(true);
		expect(subscriptionAccess(subscription('active', 'open'), 'price_pro', 1000).entitled).toBe(false);
		expect(subscriptionAccess(subscription('active', 'paid', 'price_other'), 'price_pro', 1000).entitled).toBe(false);
		expect(subscriptionAccess(subscription(), 'price_pro', 2000000000001).entitled).toBe(false);
	});
	it.each(['incomplete', 'past_due', 'unpaid', 'canceled', 'trialing'])('does not grant access for %s', status => {
		expect(subscriptionAccess(subscription(status), 'price_pro', 1000).entitled).toBe(false);
	});
	it('keeps a paid subscription until its scheduled cancellation date', () => {
		const value = subscription();
		value.cancel_at_period_end = true;
		expect(subscriptionAccess(value, 'price_pro', 1000).entitled).toBe(true);
	});
	it('reads the latest Stripe state and commits renewal atomically', async () => {
		const expiry = new Date(2000000000000);
		mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT sub') ? [{ sub: 'user_1' }] : sql.includes('MAX(') ? [{ expires_at: expiry }] : [] }));
		await syncStripeSubscription('sub_1');
		expect(mocks.retrieve).toHaveBeenCalledWith('sub_1', { expand: ['latest_invoice'] });
		expect(mocks.query).toHaveBeenCalledWith('UPDATE users SET plan = $1, plan_expires_at = $2 WHERE sub = $3', ['advanced', expiry, 'user_1']);
		expect(mocks.query).toHaveBeenLastCalledWith('COMMIT');
		expect(mocks.release).toHaveBeenCalled();
	});
	it('a repeated event reads a current canceled subscription instead of restoring Pro', async () => {
		mocks.retrieve.mockResolvedValue(subscription('canceled'));
		await syncStripeSubscription('sub_1');
		await syncStripeSubscription('sub_1');
		expect(mocks.query).toHaveBeenCalledWith('UPDATE users SET plan = $1, plan_expires_at = $2 WHERE sub = $3', ['basic', null, 'user_1']);
		expect(mocks.retrieve).toHaveBeenCalledTimes(2);
	});
	it('rolls back failures so Stripe can retry without losing the event', async () => {
		mocks.retrieve.mockRejectedValue(new Error('unavailable'));
		await expect(syncStripeSubscription('sub_1')).rejects.toThrow('unavailable');
		expect(mocks.query).toHaveBeenLastCalledWith('ROLLBACK');
		expect(mocks.release).toHaveBeenCalled();
	});
});
